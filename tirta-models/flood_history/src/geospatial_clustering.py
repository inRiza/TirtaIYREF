"""
Geospatial Clustering Module
============================
Create geographic zones for region-specific flood prediction

JUSTIFICATION FOR K-MEANS WITH K=10:
1. Indonesia has diverse flood patterns across regions (monsoon variations)
2. K=10 balances regional granularity vs sufficient data per zone
3. Each zone ≈ 37K events (adequate for reliable ML model training)
4. Captures major geographic patterns without over-fragmentation
5. Computationally efficient for real-time inference
"""

import numpy as np
import pandas as pd
from sklearn.cluster import KMeans
from sklearn.preprocessing import StandardScaler
import logging
from typing import Dict

logger = logging.getLogger(__name__)


class GeospatialClusterer:
    """Create geographic zones using K-Means clustering"""
    
    def __init__(self, n_clusters: int = 10, random_state: int = 42):
        """
        Initialize clustering
        
        Args:
            n_clusters: Number of geographic zones (10 recommended)
            random_state: For reproducibility
        """
        self.n_clusters = n_clusters
        self.random_state = random_state
        self.kmeans = None
        self.scaler = StandardScaler()
        self.cluster_info = {}
    
    def fit(self, df: pd.DataFrame) -> np.ndarray:
        """
        Fit K-Means on coordinates
        
        Args:
            df: DataFrame with 'lat' and 'lon' columns
        
        Returns:
            Cluster labels
        """
        logger.info(f"Clustering {len(df)} points into {self.n_clusters} zones...")
        
        # Sample for faster clustering if too large
        sample_size = min(len(df), 50000)
        if len(df) > 50000:
            df_sample = df.sample(n=sample_size, random_state=self.random_state)
            logger.info(f"  Sampling {sample_size} points for K-Means fitting")
        else:
            df_sample = df
        
        # Prepare coordinates
        coords = df_sample[['lat', 'lon']].values
        
        # Scale coordinates
        coords_scaled = self.scaler.fit_transform(coords)
        
        # Fit K-Means
        self.kmeans = KMeans(
            n_clusters=self.n_clusters,
            random_state=self.random_state,
            n_init=10,
            max_iter=300
        )
        
        labels = self.kmeans.fit_predict(coords_scaled)
        logger.info("[OK] K-Means clustering complete")
        
        # Analyze clusters
        self._analyze_clusters(df_sample, labels)
        
        return labels
    
    def predict(self, df: pd.DataFrame) -> np.ndarray:
        """Assign zone for new coordinates"""
        coords = df[['lat', 'lon']].values
        coords_scaled = self.scaler.transform(coords)
        return self.kmeans.predict(coords_scaled)
    
    def _analyze_clusters(self, df: pd.DataFrame, labels: np.ndarray):
        """Analyze cluster characteristics"""
        df_with_labels = df.copy()
        df_with_labels['zone'] = labels
        
        logger.info("\n" + "="*60)
        logger.info("ZONE ANALYSIS")
        logger.info("="*60)
        
        for zone_id in sorted(df_with_labels['zone'].unique()):
            zone_data = df_with_labels[df_with_labels['zone'] == zone_id]
            
            # Estimate total events in this zone
            zone_count = zone_data.shape[0]
            zone_pct = (zone_count / len(df_with_labels)) * 100
            
            center_lat = zone_data['lat'].mean()
            center_lon = zone_data['lon'].mean()
            
            # Regional name based on coordinates
            region_name = self._get_region_name(center_lat, center_lon)
            
            self.cluster_info[zone_id] = {
                'region': region_name,
                'center_lat': center_lat,
                'center_lon': center_lon,
                'sample_count': zone_count,
                'sample_pct': zone_pct,
                'bounds': {
                    'lat_min': zone_data['lat'].min(),
                    'lat_max': zone_data['lat'].max(),
                    'lon_min': zone_data['lon'].min(),
                    'lon_max': zone_data['lon'].max(),
                }
            }
            
            logger.info(f"\nZone {zone_id}: {region_name}")
            logger.info(f"  Center: ({center_lat:.2f}, {center_lon:.2f})")
            logger.info(f"  Sample events: {zone_count:,} ({zone_pct:.1f}%)")
            logger.info(f"  Bounds: Lat [{zone_data['lat'].min():.2f}, {zone_data['lat'].max():.2f}]")
            logger.info(f"          Lon [{zone_data['lon'].min():.2f}, {zone_data['lon'].max():.2f}]")
    
    @staticmethod
    def _get_region_name(lat: float, lon: float) -> str:
        """Get region name from coordinates"""
        # Sumatra
        if 95 <= lon < 105:
            if lat > 2: return "Sumatra_North"
            else: return "Sumatra_South"
        # Java & Bali
        elif 105 <= lon < 115:
            if -5 <= lat < -3: return "Java_West"
            elif -7 <= lat < -5: return "Java_Central"
            elif -8 <= lat < -6: return "Java_East"
            else: return "Bali_Region"
        # Kalimantan
        elif 110 <= lon < 120:
            if lat >= 0: return "Kalimantan_North"
            else: return "Kalimantan_South"
        # Sulawesi
        elif 120 <= lon < 130:
            return "Sulawesi"
        # East Indonesia (Papua, Maluku)
        elif lon >= 130:
            return "East_Indonesia"
        # Bali & NTT (eastern Java-Bali area)
        elif 115 <= lon < 130 and -9 <= lat < -7:
            return "Bali_NTT"
        else:
            return "Other_Region"
    
    def apply_clustering(self, df: pd.DataFrame) -> pd.DataFrame:
        """Apply clustering to full dataset"""
        logger.info("Applying clustering to full dataset...")
        
        df_result = df.copy()
        df_result['zone'] = self.predict(df)
        
        logger.info(f"[OK] Assigned {len(df_result):,} records to zones")
        
        # Show distribution
        zone_dist = df_result['zone'].value_counts().sort_index()
        logger.info("\nZone distribution:")
        for zone_id, count in zone_dist.items():
            info = self.cluster_info.get(zone_id, {})
            region = info.get('region', 'Unknown')
            logger.info(f"  Zone {zone_id} ({region}): {count:,} events ({count/len(df_result)*100:.1f}%)")
        
        return df_result
    
    def get_zone_info(self) -> Dict:
        """Get zone information"""
        return self.cluster_info


# Quick test
if __name__ == "__main__":
    from data_preparation import DataPreparation
    from config import DATA_PATH, INDONESIA_BOUNDS, CLUSTERING_CONFIG
    
    # 1. LOAD RAW DATA
    print("--- 1. LOADING RAW DATA ---")
    prep = DataPreparation(DATA_PATH, INDONESIA_BOUNDS)
    raw_data = prep.get_prepared_data() # SEKARANG HANYA MENGEMBALIKAN 1 NILAI
    
    # 2. CLUSTERING ZONE
    print("\n--- 2. CLUSTERING ZONE ---")
    clusterer = GeospatialClusterer(
        n_clusters=CLUSTERING_CONFIG['n_clusters'],
        random_state=CLUSTERING_CONFIG['random_state']
    )
    clusterer.fit(raw_data[['lat', 'lon']])
    df_with_zones = clusterer.apply_clustering(raw_data)
    
    # 3. KEMBALIKAN KE DATA PREP UNTUK DIBUAT TIME SERIES
    print("\n--- 3. CREATING ZERO-PADDED TIME SERIES ---")
    # Memasukkan df_with_zones kembali ke object DataPreparation
    prep.df_indo = df_with_zones 
    
    # Membuat Time Series berdasarkan kolom 'zone'
    final_ts_data = prep.create_time_series(spatial_col='zone', aggregation='monthly')
    
    print("\n[OK] FINAL TIME SERIES DATA SHAPE:", final_ts_data.shape)
    print("\nSample (Zone 0):")
    print(final_ts_data[final_ts_data['zone'] == 0].head())