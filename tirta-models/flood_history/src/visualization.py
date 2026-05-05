"""
Visualization Module
====================
Comprehensive, publication-ready visualizations for Spatio-Temporal Flood EWS.
Adapted for Direct Forecasting and Analytical Uncertainty Bounds.
"""

import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
import seaborn as sns
from typing import Dict, Tuple
import logging

logger = logging.getLogger(__name__)


class FloodPredictionVisualizer:
    """Create all visualizations for flood prediction"""
    
    def __init__(self, figsize: Tuple = (14, 6), style: str = 'whitegrid',
                 risk_colors: Dict = None):
        """Initialize visualizer"""
        self.figsize = figsize
        self.style = style
        sns.set_style(style)
        
        self.risk_colors = risk_colors or {
            'LOW (AMAN)': '#2ca02c',
            'MEDIUM (WASPADA)': '#ff7f0e',
            'HIGH (BAHAYA)': '#d62728',
            'UNKNOWN': '#cccccc'
        }
    
    def plot_zone_coverage(self, df_with_zones: pd.DataFrame, zone_info: Dict):
        """Plot geographic zones on map"""
        logger.info("Creating zone coverage visualization...")
        
        fig, ax = plt.subplots(figsize=self.figsize)
        
        # Color by zone
        zones = sorted(df_with_zones['zone'].unique())
        colors = plt.cm.tab10(np.linspace(0, 1, len(zones)))
        
        for zone_id, color in zip(zones, colors):
            zone_data = df_with_zones[df_with_zones['zone'] == zone_id]
            ax.scatter(zone_data['lon'], zone_data['lat'], 
                      alpha=0.5, s=15, label=f'Zone {zone_id}', color=color)
        
        ax.set_xlabel('Longitude', fontsize=11)
        ax.set_ylabel('Latitude', fontsize=11)
        ax.set_title('Geographic Zone Distribution (Indonesia Flood Hotspots)',
                    fontsize=13, fontweight='bold')
        
        # Place legend outside
        ax.legend(bbox_to_anchor=(1.01, 1), loc='upper left', fontsize=9)
        ax.grid(alpha=0.3)
        
        plt.tight_layout()
        return fig
    
    def plot_time_series_trends(self, ts_data: pd.DataFrame):
        """Plot time series trends for Count and Area"""
        logger.info("Creating time series trends visualization...")
        
        fig, axes = plt.subplots(2, 1, figsize=self.figsize)
        
        # Flood count
        axes[0].plot(ts_data['date'], ts_data['flood_count'], 
                    linewidth=1.5, color='#d62728')
        axes[0].fill_between(ts_data['date'], ts_data['flood_count'], 
                            alpha=0.2, color='#d62728')
        axes[0].set_ylabel('Number of Events', fontsize=11)
        axes[0].set_title('Monthly Flood Events History - Indonesia',
                         fontsize=13, fontweight='bold')
        axes[0].grid(alpha=0.3)
        
        # Total area
        axes[1].plot(ts_data['date'], ts_data['total_area'],
                    linewidth=1.5, color='#1f77b4')
        axes[1].fill_between(ts_data['date'], ts_data['total_area'],
                            alpha=0.2, color='#1f77b4')
        axes[1].set_ylabel('Area Affected (km²)', fontsize=11)
        axes[1].set_xlabel('Date', fontsize=11)
        axes[1].set_title('Total Monthly Area Affected',
                         fontsize=13, fontweight='bold')
        axes[1].grid(alpha=0.3)
        
        plt.tight_layout()
        return fig
    
    def plot_model_comparison(self, metrics_df: pd.DataFrame):
        """Compare Hurdle Model performance across zones"""
        logger.info("Creating model comparison visualization...")
        
        # REVISI: Hanya memplot Count dan Area
        fig, axes = plt.subplots(1, 2, figsize=(14, 5))
        
        for idx, target in enumerate(['count', 'area']):
            data = metrics_df[metrics_df['target'] == target]
            if len(data) == 0:
                continue
                
            axes[idx].bar(data['zone_name'], data['rmse'], alpha=0.8, color='#1f77b4')
            axes[idx].set_title(f'Test RMSE - {target.capitalize()} (Direct Forecast)', fontweight='bold')
            axes[idx].set_ylabel('RMSE', fontsize=10)
            axes[idx].tick_params(axis='x', rotation=45)
            axes[idx].grid(alpha=0.3, axis='y')
        
        plt.tight_layout()
        return fig
    
    def plot_forecast_with_confidence(self, forecast_df: pd.DataFrame, zone_name: str):
        """Plot forecast with Analytical Poisson Confidence Intervals"""
        logger.info(f"Creating forecast visualization for {zone_name}...")
        
        fig, axes = plt.subplots(2, 1, figsize=self.figsize)
        
        # Flood Count with CI
        ax = axes[0]
        ax.plot(forecast_df['date'], forecast_df['flood_count_pred'],
               'o-', linewidth=2.5, markersize=8, label='Prediction', color='#d62728')
        
        # REVISI: Memanggil nama kolom CI yang benar
        ax.fill_between(forecast_df['date'],
                        forecast_df['flood_count_lower_90ci'],
                        forecast_df['flood_count_upper_90ci'],
                        alpha=0.2, color='#d62728', label='90% Confidence Interval')
        
        ax.set_ylabel('Flood Count', fontsize=11)
        ax.set_title(f'EWS Forecast: Flood Frequency - {zone_name}',
                    fontsize=13, fontweight='bold')
        ax.legend(fontsize=10)
        ax.grid(alpha=0.3)
        
        # Total Area with CI
        ax = axes[1]
        ax.plot(forecast_df['date'], forecast_df['total_area_pred'],
               's--', linewidth=2.5, markersize=8, label='Prediction', color='#1f77b4')
        
        ax.fill_between(forecast_df['date'],
                        forecast_df['total_area_lower_90ci'],
                        forecast_df['total_area_upper_90ci'],
                        alpha=0.2, color='#1f77b4', label='90% Confidence Interval')
        
        ax.set_ylabel('Total Area (km²)', fontsize=11)
        ax.set_xlabel('Forecast Horizon', fontsize=11)
        ax.set_title(f'EWS Forecast: Area Affected - {zone_name}',
                    fontsize=13, fontweight='bold')
        ax.legend(fontsize=10)
        ax.grid(alpha=0.3)
        
        plt.tight_layout()
        return fig
    
    def plot_risk_levels(self, forecast_df: pd.DataFrame, zone_name: str):
        """Plot Calibrated Risk levels over forecast horizon"""
        logger.info(f"Creating risk level visualization for {zone_name}...")
        
        fig, ax = plt.subplots(figsize=(10, 5))
        
        # Map risk to colors using the new strings
        colors = [self.risk_colors.get(risk, self.risk_colors['UNKNOWN']) 
                 for risk in forecast_df['risk_level']]
        
        bars = ax.bar(range(len(forecast_df)), forecast_df['flood_count_pred'],
                     color=colors, alpha=0.85, edgecolor='black', linewidth=1.2)
        
        # Add labels and values on top of bars
        month_labels = [d.strftime('%b\n%Y') for d in forecast_df['date']]
        ax.set_xticks(range(len(forecast_df)))
        ax.set_xticklabels(month_labels, fontsize=10)
        
        for bar in bars:
            height = bar.get_height()
            ax.text(bar.get_x() + bar.get_width()/2., height,
                    f'{int(height)}',
                    ha='center', va='bottom', fontweight='bold')
        
        ax.set_ylabel('Predicted Incidents', fontsize=11)
        ax.set_title(f'Relative Risk Assessment (EWS Dashboard) - {zone_name}', 
                     fontsize=13, fontweight='bold')
        ax.grid(alpha=0.3, axis='y')
        
        # Custom legend for Risk Levels
        from matplotlib.patches import Patch
        legend_elements = [
            Patch(facecolor=self.risk_colors['LOW (AMAN)'], label='LOW (Aman)'),
            Patch(facecolor=self.risk_colors['MEDIUM (WASPADA)'], label='MEDIUM (Waspada)'),
            Patch(facecolor=self.risk_colors['HIGH (BAHAYA)'], label='HIGH (Bahaya)')
        ]
        ax.legend(handles=legend_elements, loc='upper left', fontsize=10)
        
        plt.tight_layout()
        return fig
    
    def plot_all_zones_forecast(self, all_forecasts_df: pd.DataFrame):
        """Heatmap of predictions across all zones"""
        logger.info("Creating all-zones forecast heatmap...")
        
        pivot_data = all_forecasts_df.pivot_table(
            values='flood_count_pred',
            index='zone_id',
            columns='forecast_month',
            aggfunc='mean'
        )
        
        fig, ax = plt.subplots(figsize=(12, 6))
        
        sns.heatmap(pivot_data, annot=True, fmt='.0f', cmap='YlOrRd',
                   ax=ax, cbar_kws={'label': 'Predicted Events'}, linewidths=0.5)
        
        # REVISI: Dynamic Title untuk menyesuaikan horizon berapapun (Misal 3 Bulan)
        horizon_len = len(pivot_data.columns)
        ax.set_title(f'National Early Warning Heatmap ({horizon_len}-Month Horizon)',
                    fontsize=14, fontweight='bold')
        ax.set_xlabel('Forecast Window', fontsize=11)
        ax.set_ylabel('Geographic Zone ID', fontsize=11)
        
        plt.tight_layout()
        return fig
    
    def plot_uncertainty_distribution(self, forecast: Dict, zone_name: str):
        """
        Plot analytical uncertainty bounds. 
        Replaced the bootstrapping percentiles with Poisson variance bounds.
        """
        logger.info(f"Creating analytical uncertainty bounds for {zone_name}...")
        
        fig, ax = plt.subplots(figsize=(10, 5))
        
        dates = forecast['dates']
        pred = forecast['flood_count']
        unc = forecast['uncertainty']['flood_count']
        
        # Plot 90% Confidence Interval Band
        ax.fill_between(dates, unc['lower_bound'], unc['upper_bound'], 
                        alpha=0.25, color='#d62728', label='90% Analytical Poisson Bound')
        
        ax.plot(dates, pred, 'o-', linewidth=2.5, markersize=8, color='#d62728', label='Point Estimate')
        
        ax.set_ylabel('Predicted Flood Count', fontsize=11)
        ax.set_xlabel('Forecast Horizon', fontsize=11)
        ax.set_title(f'Forecast Reliability & Uncertainty Bound - {zone_name}',
                    fontsize=13, fontweight='bold')
        
        month_labels = [d.strftime('%b %Y') for d in dates]
        ax.set_xticks(dates)
        ax.set_xticklabels(month_labels)
        
        ax.legend(fontsize=10)
        ax.grid(alpha=0.3)
        
        plt.tight_layout()
        return fig
    
    @staticmethod
    def save_figure(fig, path: str, dpi: int = 150):
        """Save figure to file with high resolution"""
        fig.savefig(path, dpi=dpi, bbox_inches='tight')
        logger.info(f"[OK] Figure saved: {path}")