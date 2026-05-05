"""
Data Preparation Module
=======================
Load, validate, and prepare grid-based flood data for Indonesia (1km x 1km cells)
Predict flood risk per grid cell
"""

import pandas as pd
import numpy as np
from shapely import wkb
from typing import Tuple
import logging
import warnings
warnings.filterwarnings('ignore')

logger = logging.getLogger(__name__)


class GridGenerator:
    """Generate 1km x 1km grid across Indonesia"""
    
    def __init__(self, indonesia_bounds: dict, cell_size_km: float = 1.0):
        """
        Initialize grid generator
        
        Args:
            indonesia_bounds: Dict with lat_min, lat_max, lon_min, lon_max
            cell_size_km: Grid cell size in kilometers (default 1km)
        """
        self.bounds = indonesia_bounds
        self.cell_size_km = cell_size_km
        
        # Approximate conversion: 1 degree ~ 111 km
        self.cell_size_deg = cell_size_km / 111.0
        
        self.grid = None
        self.grid_map = {}  # Maps (rounded_lat, rounded_lon) -> grid_id
    
    def create_grid(self) -> pd.DataFrame:
        """Create grid of 1km x 1km cells across Indonesia"""
        logger.info("Generating 1km x 1km grid across Indonesia...")
        
        lat_min = self.bounds['lat_min']
        lat_max = self.bounds['lat_max']
        lon_min = self.bounds['lon_min']
        lon_max = self.bounds['lon_max']
        
        # Generate grid centers
        lats = np.arange(lat_min, lat_max, self.cell_size_deg)
        lons = np.arange(lon_min, lon_max, self.cell_size_deg)
        
        grid_data = []
        grid_id = 0
        
        for lat in lats:
            for lon in lons:
                grid_data.append({
                    'grid_id': grid_id,
                    'lat': lat,
                    'lon': lon,
                })
                self.grid_map[(round(lat, 4), round(lon, 4))] = grid_id
                grid_id += 1
        
        self.grid = pd.DataFrame(grid_data)
        logger.info(f"Created {len(self.grid):,} grid cells")
        
        return self.grid
    
    def assign_to_grid(self, lat: float, lon: float) -> int:
        """Find grid cell ID for given coordinate"""
        lat_min = self.bounds['lat_min']
        lon_min = self.bounds['lon_min']

        # Align to the same origin used in create_grid(). Using the global zero
        # origin here causes almost all coordinates to miss the lookup table.
        lat_idx = np.floor((lat - lat_min) / self.cell_size_deg)
        lon_idx = np.floor((lon - lon_min) / self.cell_size_deg)

        lat_rounded = lat_min + lat_idx * self.cell_size_deg
        lon_rounded = lon_min + lon_idx * self.cell_size_deg
        
        key = (round(float(lat_rounded), 4), round(float(lon_rounded), 4))
        return self.grid_map.get(key, -1)


class GridBasedDataPreparation:
    """Prepare raw flood data aggregated into 1km x 1km grid cells"""
    
    def __init__(self, data_path: str, indonesia_bounds: dict, cell_size_km: float = 1.0, min_samples: int = 24):
        """
        Initialize grid-based data preparation
        
        Args:
            data_path: Path to parquet file
            indonesia_bounds: Dict with lat_min, lat_max, lon_min, lon_max
            cell_size_km: Grid cell size in kilometers
            min_samples: Minimum months of data required per grid cell
        """
        self.data_path = data_path
        self.bounds = indonesia_bounds
        self.cell_size_km = cell_size_km
        self.min_samples = min_samples
        self.df = None
        self.df_indo = None
        self.risk_data = None
        self.grid_gen = GridGenerator(indonesia_bounds, cell_size_km)
    
    def load_data(self) -> pd.DataFrame:
        """Load parquet data"""
        logger.info(f"Loading data from {self.data_path}")
        self.df = pd.read_parquet(self.data_path)
        logger.info(f"Loaded {len(self.df):,} records")
        return self.df
    
    def extract_coordinates(self):
        """Extract lat/lon from WKB geometry"""
        logger.info("Extracting coordinates from geometry...")
        
        def extract_centroid(geom_bytes):
            try:
                geom = wkb.loads(geom_bytes)
                centroid = geom.centroid
                return centroid.y, centroid.x  # lat, lon
            except:
                return None, None
        
        self.df['lat'], self.df['lon'] = zip(*self.df['geometry'].apply(extract_centroid))
        valid = self.df['lat'].notna().sum()
        logger.info(f"Extracted {valid:,} valid coordinates")
    
    def filter_indonesia(self) -> pd.DataFrame:
        """Filter data to Indonesia region only"""
        logger.info("Filtering to Indonesia bounds...")
        
        mask = (self.df['lat'] >= self.bounds['lat_min']) & \
               (self.df['lat'] <= self.bounds['lat_max']) & \
               (self.df['lon'] >= self.bounds['lon_min']) & \
               (self.df['lon'] <= self.bounds['lon_max'])
        
        self.df_indo = self.df[mask].copy().reset_index(drop=True)
        self.df_indo = self.df_indo.sort_values('start_date').reset_index(drop=True)
        
        logger.info(f"Indonesia events: {len(self.df_indo):,} "
                    f"({len(self.df_indo)/len(self.df)*100:.1f}% of total)")
        
        return self.df_indo
    
    def assign_to_grid(self):
        """Assign each flood event to a 1km x 1km grid cell"""
        logger.info("Assigning events to grid cells...")
        
        self.df_indo['grid_id'] = self.df_indo.apply(
            lambda row: self.grid_gen.assign_to_grid(row['lat'], row['lon']),
            axis=1
        )
        
        # Filter out events that couldn't be assigned
        self.df_indo = self.df_indo[self.df_indo['grid_id'] != -1].copy()
        
        valid_cells = self.df_indo['grid_id'].nunique()
        logger.info(f"Events assigned to {valid_cells:,} grid cells")

        if len(self.df_indo) == 0:
            logger.warning("No events were assigned to grid cells. Check grid alignment and bounds.")
        else:
            logger.info(
                f"Assigned {len(self.df_indo):,} events; grid_id range: "
                f"{self.df_indo['grid_id'].min()} - {self.df_indo['grid_id'].max()}"
            )
    
    def create_monthly_timeseries(self) -> pd.DataFrame:
        """
        Create monthly time series for each grid cell
        Aggregate flood events within each 1km x 1km cell
        
        Returns:
            DataFrame with columns: [year_month, grid_id, lat, lon, flood_count, total_area, max_area]
        """
        logger.info("Creating monthly time series per grid cell...")
        
        self.df_indo['start_date'] = pd.to_datetime(self.df_indo['start_date'], errors='coerce')
        
        # Filter out rows with NaT dates
        valid_data = self.df_indo.dropna(subset=['start_date']).copy()
        logger.info(f"Filtered to {len(valid_data):,} events with valid dates (dropped {len(self.df_indo) - len(valid_data):,})")
        
        valid_data['year_month'] = valid_data['start_date'].dt.to_period('M')
        
        # Aggregate by year_month and grid_id
        ts = valid_data.groupby(['year_month', 'grid_id']).agg({
            'area_km2': ['count', 'sum', 'max'],
            'lat': 'first',  # Keep grid center coordinates
            'lon': 'first'
        }).reset_index()
        
        ts.columns = ['year_month', 'grid_id', 'flood_count', 'total_area', 'max_area', 'lat', 'lon']
        ts = ts.sort_values(['grid_id', 'year_month']).reset_index(drop=True)
        
        logger.info(f"Created time series for {ts['grid_id'].nunique():,} grid cells")
        
        return ts
            
    def pad_timeseries(self, ts: pd.DataFrame) -> pd.DataFrame:
        """
        Fill missing months with zeros for complete time series per grid cell
        """
        logger.info("Padding time series with zeros for missing months...")
        
        # Filter out rows where year_month is NaT
        ts = ts.dropna(subset=['year_month']).copy()
        
        # Convert period to timestamp
        ts['date'] = ts['year_month'].dt.to_timestamp()
        ts = ts.drop('year_month', axis=1)
        
        # Filter out NaT dates
        ts = ts.dropna(subset=['date'])
        
        if len(ts) == 0:
            logger.warning("No valid date values found in time series!")
            return ts
        
        all_dates = pd.date_range(ts['date'].min(), ts['date'].max(), freq='MS')
        grid_ids = ts['grid_id'].unique()
        
        # Create complete grid
        idx = pd.MultiIndex.from_product(
            [grid_ids, all_dates],
            names=['grid_id', 'date']
        )
        complete_grid = pd.DataFrame(index=idx).reset_index()
        
        # Merge with actual data
        ts = pd.merge(complete_grid, ts, on=['grid_id', 'date'], how='left')
        
        # Fill missing values with 0
        ts['flood_count'] = ts['flood_count'].fillna(0).astype(int)
        ts['total_area'] = ts['total_area'].fillna(0)
        ts['max_area'] = ts['max_area'].fillna(0)
        
        # Forward fill coordinates (they should be constant per grid)
        ts['lat'] = ts.groupby('grid_id')['lat'].ffill().bfill()
        ts['lon'] = ts.groupby('grid_id')['lon'].ffill().bfill()
        
        ts = ts.sort_values(['grid_id', 'date']).reset_index(drop=True)
        logger.info(f"Padded to {len(ts):,} records ({ts['grid_id'].nunique()} grid cells)")
        
        return ts
    
    def generate_risk_labels(self, ts: pd.DataFrame) -> pd.DataFrame:
        """
        Generate risk score (0-100) based on flood frequency per grid cell
        Risk Score = normalized flood count * 100
        """
        logger.info("Generating risk labels (0-100 score)...")
        
        # Calculate risk score per grid cell
        grid_stats = ts.groupby('grid_id').agg({
            'flood_count': ['max', 'mean'],
            'total_area': 'max'
        }).reset_index()
        
        grid_stats.columns = ['grid_id', 'max_flood_count', 'mean_flood_count', 'max_total_area']
        
        # Merge back and calculate risk score
        ts = ts.merge(grid_stats, on='grid_id')
        
        # Risk score: normalize flood count to 0-100
        ts['risk_score'] = (ts['flood_count'] / (ts['max_flood_count'] + 1)) * 100
        ts['risk_score'] = ts['risk_score'].clip(0, 100)
        
        logger.info(f"Risk score range: {ts['risk_score'].min():.1f} - {ts['risk_score'].max():.1f}")
        
        return ts
    
    def prepare_for_modeling(self, ts: pd.DataFrame, lookback: int = 12, 
                            test_split: float = 0.2) -> Tuple[pd.DataFrame, pd.DataFrame]:
        """
        Prepare data for model training (grid-based)
        
        Args:
            ts: Time series DataFrame
            lookback: Historical window size
            test_split: Train-test split ratio
            
        Returns:
            (train_data, test_data) - each grid cell has its own train/test split
        """
        logger.info("Preparing data for modeling...")
        
        all_train = []
        all_test = []
        
        for grid_id, group in ts.groupby('grid_id'):
            group = group.sort_values('date').reset_index(drop=True)
            
            # Skip grid cells with insufficient data
            if len(group) < lookback + 1:
                logger.debug(f"Grid {grid_id} has only {len(group)} samples, skipping")
                continue
            
            # Create train-test split
            split_idx = int(len(group) * (1 - test_split))
            
            train = group.iloc[:split_idx].copy()
            test = group.iloc[split_idx:].copy()
            
            all_train.append(train)
            all_test.append(test)
        
        df_train = pd.concat(all_train, ignore_index=True)
        df_test = pd.concat(all_test, ignore_index=True)
        
        n_train_cells = df_train['grid_id'].nunique()
        n_test_cells = df_test['grid_id'].nunique()
        
        logger.info(f"Train set: {len(df_train):,} records ({n_train_cells} grid cells)")
        logger.info(f"Test set: {len(df_test):,} records ({n_test_cells} grid cells)")
        
        return df_train, df_test
    
    def validate_data(self) -> dict:
        """Validate data quality"""
        logger.info("Validating data...")
        
        stats = {
            'total_records': len(self.df_indo),
            'total_events': len(self.df_indo),
            'grid_cells_covered': self.df_indo['grid_id'].nunique(),
            'missing_coords': self.df_indo['lat'].isna().sum(),
            'date_range': f"{self.df_indo['start_date'].min()} to {self.df_indo['start_date'].max()}",
        }
        
        logger.info("Data validation complete")
        return stats
    
    def get_prepared_data(self) -> pd.DataFrame:
        """Full pipeline for data preparation"""
        self.load_data()
        self.extract_coordinates()
        self.filter_indonesia()
        self.grid_gen.create_grid()
        self.assign_to_grid()
        self.validate_data()
        
        return self.df_indo


# Quick test
if __name__ == "__main__":
    from config import DATA_PATH, INDONESIA_BOUNDS, LOOKBACK_WINDOW, DATA_CONFIG
    
    prep = GridBasedDataPreparation(DATA_PATH, INDONESIA_BOUNDS, 
                                    cell_size_km=1.0,
                                    min_samples=DATA_CONFIG['min_samples_per_location'])
    
    # Full pipeline
    raw_data = prep.get_prepared_data()
    print(f"Raw data: {raw_data.shape}")
    
    ts = prep.create_monthly_timeseries()
    ts = prep.pad_timeseries(ts)
    ts = prep.generate_risk_labels(ts)
    
    train, test = prep.prepare_for_modeling(ts, lookback=LOOKBACK_WINDOW, 
                                           test_split=DATA_CONFIG['test_split'])
    
    print(f"\nFinal train shape: {train.shape}")
    print(f"Final test shape: {test.shape}")