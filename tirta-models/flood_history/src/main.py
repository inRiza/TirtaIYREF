"""
Main Pipeline - Grid-Based Flood Risk Forecasting
==================================================
Complete workflow from raw data to 1km x 1km grid risk predictions
"""

import logging
import pandas as pd
from config import (
    DATA_PATH, INDONESIA_BOUNDS, DATA_CONFIG,
    MODELS_CONFIG, FEATURE_CONFIG, RISK_CONFIG
)
from data_preparation import GridBasedDataPreparation
from feature_engineering import FeatureEngineer
from models import ModelComparator
from forecasting import GridRiskForecaster, get_risk_category_summary

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


class FloodRiskPipeline:
    """Complete pipeline for grid-based flood risk forecasting"""
    
    def __init__(self, config_dict=None, cell_size_km: float = 1.0):
        """Initialize pipeline with configuration"""
        self.config = {
            'DATA_CONFIG': DATA_CONFIG,
            'MODELS_CONFIG': MODELS_CONFIG,
            'FEATURE_CONFIG': FEATURE_CONFIG,
            'RISK_CONFIG': RISK_CONFIG,
        }
        if config_dict:
            self.config.update(config_dict)
        
        self.cell_size_km = cell_size_km
        self.data = None
        self.models = None
        self.forecaster = None
    
    def stage_1_data_preparation(self):
        """Load and prepare grid-based data"""
        logger.info("\n" + "="*70)
        logger.info("STAGE 1: DATA PREPARATION (1km x 1km Grid)")
        logger.info("="*70)
        
        prep = GridBasedDataPreparation(DATA_PATH, INDONESIA_BOUNDS,
                                       cell_size_km=self.cell_size_km,
                                       min_samples=self.config['DATA_CONFIG']['min_samples_per_location'])
        
        # Load raw data
        raw_data = prep.get_prepared_data()
        logger.info(f"Raw data: {raw_data.shape} records")
        
        # Create time series
        ts = prep.create_monthly_timeseries()
        logger.info(f"Time series created: {ts.shape} records")
        
        # Pad with zeros
        ts = prep.pad_timeseries(ts)
        logger.info(f"Padded time series: {ts.shape} records")
        
        # Generate risk labels
        ts = prep.generate_risk_labels(ts)
        logger.info(f"Risk labels generated, range: {ts['risk_score'].min():.1f} - {ts['risk_score'].max():.1f}")
        logger.info(f"Total grid cells: {ts['grid_id'].nunique()}")
        
        # Prepare for modeling
        df_train, df_test = prep.prepare_for_modeling(
            ts, 
            lookback=self.config['DATA_CONFIG']['lookback_window'],
            test_split=self.config['DATA_CONFIG']['test_split']
        )
        
        self.data = {
            'raw': raw_data,
            'timeseries': ts,
            'train': df_train,
            'test': df_test,
        }
        
        return df_train, df_test
    
    def stage_2_feature_engineering(self, df_train, df_test):
        """Create features"""
        logger.info("\n" + "="*70)
        logger.info("STAGE 2: FEATURE ENGINEERING")
        logger.info("="*70)
        
        fe = FeatureEngineer(self.config['FEATURE_CONFIG'])
        
        # Create features for train and test
        df_train_feat, feature_cols = fe.create_features(df_train)
        df_test_feat = df_test.copy()
        
        logger.info(f"Features created: {len(feature_cols)} features")
        logger.info(f"Training set after feature engineering: {df_train_feat.shape}")
        
        # Prepare X, y for modeling
        X_train = df_train_feat[feature_cols].fillna(0)
        y_train = df_train_feat['risk_score']
        
        X_test = df_test_feat[feature_cols].fillna(0) if feature_cols[0] in df_test_feat.columns else df_test[feature_cols].fillna(0)
        y_test = df_test_feat['risk_score'] if 'risk_score' in df_test_feat.columns else df_test['risk_score']
        
        self.feature_engineer = fe
        self.feature_columns = feature_cols
        
        return X_train, y_train, X_test, y_test
    
    def stage_3_model_training(self, X_train, y_train):
        """Train all models"""
        logger.info("\n" + "="*70)
        logger.info("STAGE 3: MODEL TRAINING")
        logger.info("="*70)
        
        mc = ModelComparator(self.config['MODELS_CONFIG'])
        mc.init_models()
        mc.train_all(X_train, y_train)
        
        self.models = mc
        
        return mc
    
    def stage_4_model_evaluation(self, X_test, y_test):
        """Evaluate models"""
        logger.info("\n" + "="*70)
        logger.info("STAGE 4: MODEL EVALUATION")
        logger.info("="*70)
        
        predictions = self.models.predict_all(X_test)
        results = self.models.evaluate_all(y_test, predictions)
        
        # Print comparison
        logger.info("\nModel Performance Comparison:")
        for model_name, metrics in results.items():
            logger.info(f"\n{model_name.upper()}:")
            for metric, value in metrics.items():
                logger.info(f"  {metric}: {value:.4f}")
        
        self.evaluation_results = results
        return results
    
    def stage_5_create_forecaster(self):
        """Create grid-based forecaster"""
        logger.info("\n" + "="*70)
        logger.info("STAGE 5: FORECASTER SETUP")
        logger.info("="*70)
        
        full_config = {
            'RISK_CONFIG': self.config['RISK_CONFIG'],
            'FEATURE_CONFIG': self.config['FEATURE_CONFIG'],
        }
        
        forecaster = GridRiskForecaster(
            self.models,
            self.feature_engineer,
            full_config
        )
        
        self.forecaster = forecaster
        logger.info("Grid-based forecaster ready")
        
        return forecaster
    
    def forecast_grid_cell(self, grid_id: int, use_model: str = 'xgboost'):
        """Forecast risk for specific grid cell"""
        if self.forecaster is None:
            raise ValueError("Pipeline not fully initialized. Run full pipeline first.")
        
        result = self.forecaster.forecast_3months_grid(
            self.data['timeseries'],
            grid_id,
            use_model=use_model
        )
        
        return result
    
    def forecast_all_cells(self, use_model: str = 'xgboost') -> pd.DataFrame:
        """Forecast for all grid cells"""
        if self.forecaster is None:
            raise ValueError("Pipeline not fully initialized. Run full pipeline first.")
        
        result = self.forecaster.forecast_all_grids(
            self.data['timeseries'],
            use_model=use_model,
            skip_errors=True
        )
        
        return result
    
    def compare_models_grid(self, grid_id: int):
        """Compare all models for specific grid cell"""
        if self.forecaster is None:
            raise ValueError("Pipeline not fully initialized. Run full pipeline first.")
        
        result = self.forecaster.compare_models_grid(
            self.data['timeseries'],
            grid_id
        )
        
        return result
    
    def run_full_pipeline(self):
        """Run complete pipeline"""
        logger.info("\n\n")
        logger.info("╔" + "="*68 + "╗")
        logger.info("║  FLOOD RISK FORECASTING - GRID-BASED APPROACH" + " "*22 + "║")
        logger.info("║  1km x 1km Grid Cells across Indonesia" + " "*31 + "║")
        logger.info("╚" + "="*68 + "╝")
        
        # Stage 1: Data
        df_train, df_test = self.stage_1_data_preparation()
        
        # Stage 2: Features
        X_train, y_train, X_test, y_test = self.stage_2_feature_engineering(df_train, df_test)
        
        # Stage 3: Training
        self.stage_3_model_training(X_train, y_train)
        
        # Stage 4: Evaluation
        self.stage_4_model_evaluation(X_test, y_test)
        
        # Stage 5: Forecaster
        self.stage_5_create_forecaster()
        
        logger.info("\n✓ Pipeline completed successfully!")
        
        return self


# ============================================================
# EXAMPLE USAGE
# ============================================================
if __name__ == "__main__":
    
    # Initialize and run full pipeline
    pipeline = FloodRiskPipeline(cell_size_km=1.0)
    pipeline.run_full_pipeline()
    
    # Example 1: Forecast entire grid
    logger.info("\n" + "="*70)
    logger.info("EXAMPLE 1: FORECAST ALL GRID CELLS")
    logger.info("="*70)
    
    forecast_grid = pipeline.forecast_all_cells(use_model='xgboost')
    
    logger.info(f"\nGenerated forecasts for {len(forecast_grid)} grid cells")
    logger.info("\nTop 10 highest risk cells:")
    top_risk = forecast_grid.nlargest(10, 'average_risk')[
        ['grid_id', 'lat', 'lon', 'average_risk', 'category_month1']
    ]
    
    for idx, row in top_risk.iterrows():
        logger.info(f"  Grid {row['grid_id']}: ({row['lat']:.4f}, {row['lon']:.4f}) "
                   f"- Risk: {row['average_risk']:.1f} ({row['category_month1']})")
    
    # Example 2: Forecast specific grid cell
    logger.info("\n" + "="*70)
    logger.info("EXAMPLE 2: FORECAST SPECIFIC GRID CELL")
    logger.info("="*70)
    
    # Get a random grid cell ID from the data
    sample_grid_id = pipeline.data['timeseries']['grid_id'].sample(1).values[0]
    
    logger.info(f"\nForecast for Grid Cell {sample_grid_id}:")
    forecast = pipeline.forecast_grid_cell(sample_grid_id, use_model='xgboost')
    
    if 'error' not in forecast:
        logger.info(f"Location: ({forecast['lat']}, {forecast['lon']})")
        logger.info(f"Average Risk Score: {forecast['average_risk']}")
        logger.info(f"Highest Risk Month: {forecast['highest_risk_month']} with score {forecast['highest_risk_score']}")
        
        logger.info("\n3-Month Forecast:")
        for pred in forecast['predictions']:
            logger.info(f"  Month {pred['month']}: {pred['label']} (Score: {pred['risk_score']})")
    else:
        logger.error(f"Forecast failed: {forecast['error']}")
    
    # Example 3: Compare models on specific grid
    logger.info("\n" + "="*70)
    logger.info("EXAMPLE 3: MODEL COMPARISON ON GRID CELL")
    logger.info("="*70)
    
    comparison = pipeline.compare_models_grid(sample_grid_id)
    
    if 'models' in comparison:
        logger.info(f"\nAverage risk across models: {comparison.get('summary', {}).get('avg_risk_across_models', 'N/A')}")
        logger.info("Risk range:")
        logger.info(f"  Min: {comparison.get('summary', {}).get('min_risk', 'N/A')}")
        logger.info(f"  Max: {comparison.get('summary', {}).get('max_risk', 'N/A')}")
        
        logger.info("\nPer-model average risk:")
        for model_name, result in comparison['models'].items():
            logger.info(f"  {model_name}: {result['average_risk']:.1f}")
    
    # Risk categories reference
    logger.info("\n" + "="*70)
    logger.info("RISK CATEGORIES")
    logger.info("="*70)
    categories = get_risk_category_summary()
    for cat, info in categories.items():
        logger.info(f"{cat}: {info['label']} ({info['range']}) - {info['description']}")
