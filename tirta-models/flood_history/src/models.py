"""
Grid-Based Risk Forecasting Models
===================================
4 comparison models: XGBoost, SARIMA, Prophet, LSTM
All output risk score (0-100) for 3-month ahead forecast
"""

import numpy as np
import pandas as pd
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import mean_squared_error, mean_absolute_error, r2_score
import logging
from typing import Dict

logger = logging.getLogger(__name__)


class BaseRiskModel:
    """Base class for all risk forecasting models"""
    
    def __init__(self, model_name: str, config: Dict):
        self.model_name = model_name
        self.config = config
        self.is_trained = False
        self.metrics = {}
    
    def fit(self, X_train: pd.DataFrame, y_train: pd.Series):
        """Train the model"""
        raise NotImplementedError
    
    def predict(self, X_test: pd.DataFrame) -> np.ndarray:
        """Predict risk scores"""
        raise NotImplementedError
    
    def evaluate(self, y_true: pd.Series, y_pred: np.ndarray) -> Dict:
        """Evaluate model performance"""
        mse = mean_squared_error(y_true, y_pred)
        mae = mean_absolute_error(y_true, y_pred)
        rmse = np.sqrt(mse)
        r2 = r2_score(y_true, y_pred)
        
        self.metrics = {
            'mse': mse,
            'mae': mae,
            'rmse': rmse,
            'r2': r2,
        }
        
        logger.info(f"{self.model_name} - MAE: {mae:.3f}, RMSE: {rmse:.3f}, R²: {r2:.3f}")
        return self.metrics


class XGBoostRiskModel(BaseRiskModel):
    """XGBoost model for risk forecasting"""
    
    def __init__(self, config: Dict):
        super().__init__('XGBoost', config)
        try:
            import xgboost as xgb
            self.xgb = xgb
            self.model = None
        except ImportError:
            logger.error("XGBoost not installed")
            raise
    
    def fit(self, X_train: pd.DataFrame, y_train: pd.Series):
        """Train XGBoost model"""
        logger.info(f"Training {self.model_name}...")
        
        cfg = self.config['xgboost']
        
        dtrain = self.xgb.DMatrix(X_train, label=y_train)
        
        params = {
            'objective': cfg['objective'],
            'max_depth': cfg['max_depth'],
            'learning_rate': cfg['learning_rate'],
            'subsample': cfg['subsample'],
            'colsample_bytree': cfg['colsample_bytree'],
        }
        
        self.model = self.xgb.train(
            params,
            dtrain,
            num_boost_round=cfg['n_estimators'],
            verbose_eval=False
        )
        
        self.is_trained = True
        logger.info(f"{self.model_name} trained successfully")
    
    def predict(self, X_test: pd.DataFrame) -> np.ndarray:
        """Predict risk scores"""
        if not self.is_trained:
            raise ValueError(f"{self.model_name} not trained yet")
        
        dtest = self.xgb.DMatrix(X_test)
        predictions = self.model.predict(dtest)
        
        # Clip to 0-100 range
        predictions = np.clip(predictions, 0, 100)
        return predictions


class SARIMAModel(BaseRiskModel):
    """SARIMA model for risk forecasting"""
    
    def __init__(self, config: Dict):
        super().__init__('SARIMA', config)
        try:
            from statsmodels.tsa.arima.model import ARIMA
            self.ARIMA = ARIMA
            self.model = None
            self.scaler = StandardScaler()
        except ImportError:
            logger.error("Statsmodels not installed")
            raise
    
    def fit(self, X_train: pd.DataFrame, y_train: pd.Series):
        """Train SARIMA model on time series"""
        logger.info(f"Training {self.model_name}...")
        
        cfg = self.config['sarima']
        
        # Fit ARIMA on target variable (univariate time series)
        # For simplicity, fit on y_train directly
        try:
            self.model = self.ARIMA(
                y_train.values,
                order=cfg['order'],
                seasonal_order=cfg['seasonal_order'],
            )
            self.model = self.model.fit()
            self.is_trained = True
            logger.info(f"{self.model_name} trained successfully")
        except Exception as e:
            logger.error(f"SARIMA training failed: {e}")
            raise
    
    def predict(self, X_test: pd.DataFrame) -> np.ndarray:
        """Predict risk scores"""
        if not self.is_trained:
            raise ValueError(f"{self.model_name} not trained yet")
        
        # Forecast next steps
        n_periods = len(X_test)
        forecast = self.model.get_forecast(steps=n_periods)
        predictions = forecast.predicted_mean.values
        
        # Clip to 0-100 range
        predictions = np.clip(predictions, 0, 100)
        return predictions


class ProphetModel(BaseRiskModel):
    """Facebook Prophet model for risk forecasting"""
    
    def __init__(self, config: Dict):
        super().__init__('Prophet', config)
        try:
            from prophet import Prophet
            self.Prophet = Prophet
            self.model = None
        except ImportError:
            logger.error("Prophet not installed")
            raise
    
    def fit(self, X_train: pd.DataFrame, y_train: pd.Series):
        """Train Prophet model"""
        logger.info(f"Training {self.model_name}...")
        
        cfg = self.config['prophet']
        
        # Prepare data for Prophet (requires 'ds' and 'y' columns)
        df_prophet = pd.DataFrame({
            'ds': pd.date_range(start='2020-01-01', periods=len(y_train), freq='MS'),
            'y': y_train.values
        })
        
        try:
            self.model = self.Prophet(
                yearly_seasonality=cfg['yearly_seasonality'],
                weekly_seasonality=cfg['weekly_seasonality'],
                daily_seasonality=cfg['daily_seasonality'],
                changepoint_prior_scale=cfg['changepoint_prior_scale'],
                interval_width=cfg['interval_width'],
            )
            self.model.fit(df_prophet)
            self.is_trained = True
            logger.info(f"{self.model_name} trained successfully")
        except Exception as e:
            logger.error(f"Prophet training failed: {e}")
            raise
    
    def predict(self, X_test: pd.DataFrame) -> np.ndarray:
        """Predict risk scores"""
        if not self.is_trained:
            raise ValueError(f"{self.model_name} not trained yet")
        
        # Create future dataframe
        n_periods = len(X_test)
        future = self.model.make_future_dataframe(periods=n_periods, freq='MS')
        forecast = self.model.predict(future)
        
        # Get last n predictions
        predictions = forecast.tail(n_periods)['yhat'].values
        
        # Clip to 0-100 range
        predictions = np.clip(predictions, 0, 100)
        return predictions


class LSTMModel(BaseRiskModel):
    """LSTM model for risk forecasting"""
    
    def __init__(self, config: Dict):
        super().__init__('LSTM', config)
        try:
            import tensorflow as tf
            from tensorflow.keras.models import Sequential
            from tensorflow.keras.layers import LSTM, Dense, Dropout
            from tensorflow.keras.optimizers import Adam
            
            self.tf = tf
            self.Sequential = Sequential
            self.LSTM_layer = LSTM
            self.Dense = Dense
            self.Dropout = Dropout
            self.Adam = Adam
            
            self.model = None
            self.scaler = StandardScaler()
        except ImportError:
            logger.error("TensorFlow not installed")
            raise
    
    def _prepare_sequences(self, X: np.ndarray, y: np.ndarray, seq_length: int):
        """Prepare sequences for LSTM"""
        X_seq, y_seq = [], []
        
        for i in range(len(X) - seq_length):
            X_seq.append(X[i:i+seq_length])
            y_seq.append(y[i+seq_length])
        
        return np.array(X_seq), np.array(y_seq)
    
    def fit(self, X_train: pd.DataFrame, y_train: pd.Series):
        """Train LSTM model"""
        logger.info(f"Training {self.model_name}...")
        
        cfg = self.config['lstm']
        
        # Scale features
        X_scaled = self.scaler.fit_transform(X_train)
        
        # Prepare sequences
        X_seq, y_seq = self._prepare_sequences(X_scaled, y_train.values, cfg['seq_length'])
        
        # Build LSTM model
        self.model = self.Sequential()
        
        for units in cfg['units']:
            self.model.add(self.LSTM_layer(units, activation='relu', return_sequences=True))
            self.model.add(self.Dropout(cfg['dropout']))
        
        self.model.add(self.LSTM_layer(32, activation='relu'))
        self.model.add(self.Dropout(cfg['dropout']))
        self.model.add(self.Dense(16, activation='relu'))
        self.model.add(self.Dense(1, activation='linear'))  # Output layer
        
        self.model.compile(optimizer=self.Adam(), loss=cfg['loss'])
        
        # Train
        self.model.fit(
            X_seq, y_seq,
            epochs=cfg['epochs'],
            batch_size=cfg['batch_size'],
            validation_split=cfg['validation_split'],
            verbose=0
        )
        
        self.is_trained = True
        logger.info(f"{self.model_name} trained successfully")
    
    def predict(self, X_test: pd.DataFrame) -> np.ndarray:
        """Predict risk scores"""
        if not self.is_trained:
            raise ValueError(f"{self.model_name} not trained yet")
        
        # Scale features
        X_scaled = self.scaler.transform(X_test)
        
        predictions = self.model.predict(X_scaled.reshape(-1, X_scaled.shape[1], 1), verbose=0)
        predictions = predictions.flatten()
        
        # Clip to 0-100 range
        predictions = np.clip(predictions, 0, 100)
        return predictions


class ModelComparator:
    """Compare multiple risk forecasting models"""
    
    def __init__(self, config: Dict):
        self.config = config
        self.models = {}
        self.results = {}
    
    def init_models(self) -> Dict[str, BaseRiskModel]:
        """Initialize all 4 models"""
        logger.info("Initializing models...")
        
        try:
            self.models['xgboost'] = XGBoostRiskModel(self.config)
            logger.info("✓ XGBoost initialized")
        except:
            logger.warning("✗ XGBoost initialization failed")
        
        try:
            self.models['sarima'] = SARIMAModel(self.config)
            logger.info("✓ SARIMA initialized")
        except:
            logger.warning("✗ SARIMA initialization failed")
        
        try:
            self.models['prophet'] = ProphetModel(self.config)
            logger.info("✓ Prophet initialized")
        except:
            logger.warning("✗ Prophet initialization failed")
        
        try:
            self.models['lstm'] = LSTMModel(self.config)
            logger.info("✓ LSTM initialized")
        except:
            logger.warning("✗ LSTM initialization failed")
        
        logger.info(f"Initialized {len(self.models)} models")
        return self.models
    
    def train_all(self, X_train: pd.DataFrame, y_train: pd.Series):
        """Train all models"""
        logger.info("\n" + "="*60)
        logger.info("TRAINING ALL MODELS")
        logger.info("="*60)
        
        for model_name, model in self.models.items():
            try:
                model.fit(X_train, y_train)
            except Exception as e:
                logger.error(f"Training {model_name} failed: {e}")
    
    def predict_all(self, X_test: pd.DataFrame) -> Dict[str, np.ndarray]:
        """Predict with all models"""
        predictions = {}
        
        for model_name, model in self.models.items():
            try:
                pred = model.predict(X_test)
                predictions[model_name] = pred
            except Exception as e:
                logger.error(f"Prediction with {model_name} failed: {e}")
        
        return predictions
    
    def evaluate_all(self, y_test: pd.Series, predictions: Dict[str, np.ndarray]) -> Dict:
        """Evaluate all models"""
        logger.info("\n" + "="*60)
        logger.info("MODEL EVALUATION")
        logger.info("="*60)
        
        results = {}
        
        for model_name, pred in predictions.items():
            if model_name in self.models:
                metrics = self.models[model_name].evaluate(y_test, pred)
                results[model_name] = metrics
        
        return results