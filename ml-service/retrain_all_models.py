"""
Automated Model Retraining Pipeline

Orchestrates retraining of all ML models with performance comparison,
automatic promotion, and rollback capabilities.

Author: Dev Agent
Date: April 25, 2026
"""

import os
import sys
import json
import joblib
from datetime import datetime
from typing import Dict, Any, Tuple

# Add utils to path
sys.path.append(os.path.dirname(__file__))

from utils.model_versioning import ModelVersionManager
from utils.db_connection import query_to_dataframe
from utils.data_extraction import extract_sales_history, extract_transaction_items
from utils.preprocessing import create_time_features, create_train_test_split

# Import training scripts
from train_forecast_model import train_forecast_model
from train_inventory_model import train_inventory_model
from train_recommendation_model import train_recommendation_model


class ModelRetrainingPipeline:
    """
    Automated pipeline for retraining all ML models.

    Features:
    - Data extraction from live database
    - Model training with latest data
    - Performance comparison with current models
    - Automatic promotion if performance improves
    - Rollback capability
    - Comprehensive logging
    """

    def __init__(self, config_path: str = "retraining_config.json"):
        """
        Initialize retraining pipeline.

        Args:
            config_path: Path to retraining configuration file
        """
        self.version_manager = ModelVersionManager()
        self.config = self._load_config(config_path)
        self.results = {
            "timestamp": datetime.now().isoformat(),
            "models": {}
        }

    def _load_config(self, config_path: str) -> Dict:
        """Load retraining configuration."""
        default_config = {
            "forecast": {
                "enabled": True,
                "auto_promote": True,
                "improvement_threshold": 0.0,  # Promote if MAPE improves by any amount
                "metric": "MAPE",
                "metric_direction": "lower"  # lower is better
            },
            "inventory": {
                "enabled": True,
                "auto_promote": True,
                "improvement_threshold": 0.0,
                "metric": "R2",
                "metric_direction": "higher"  # higher is better
            },
            "recommendations": {
                "enabled": True,
                "auto_promote": True,
                "improvement_threshold": 0.0,
                "metric": "average_confidence",
                "metric_direction": "higher"
            },
            "data": {
                "min_days": 90,  # Minimum days of data required
                "train_test_split": 0.8
            },
            "cleanup": {
                "enabled": True,
                "keep_last_n_versions": 5
            }
        }

        if os.path.exists(config_path):
            with open(config_path, 'r') as f:
                loaded_config = json.load(f)
                # Merge with defaults
                default_config.update(loaded_config)

        return default_config

    def retrain_forecast_model(self) -> Tuple[bool, Dict]:
        """
        Retrain sales forecasting model.

        Returns:
            Tuple of (success, metrics)
        """
        print("\n" + "="*80)
        print("🔄 RETRAINING SALES FORECAST MODEL")
        print("="*80)

        try:
            # Extract fresh data
            print("\n📊 Extracting sales data...")
            df = extract_sales_history()

            if len(df) < self.config["data"]["min_days"]:
                print(f"❌ Insufficient data: {len(df)} days (minimum: {self.config['data']['min_days']})")
                return False, {}

            print(f"✓ Extracted {len(df)} days of sales data")

            # Train new model
            print("\n🤖 Training SARIMAX model...")
            metrics = train_forecast_model(force_retrain=True)

            # Save new version
            print("\n💾 Saving new model version...")
            version_id = self.version_manager.save_model_version(
                model_type="forecast",
                model_files={
                    "sales_forecast_model.pkl": "models/sales_forecast_model.pkl",
                    "best_forecast_params.pkl": "models/best_forecast_params.pkl"
                },
                metrics=metrics,
                metadata={
                    "training_days": len(df),
                    "retrained_at": datetime.now().isoformat(),
                    "auto_retrain": True
                }
            )

            # Compare with current production model
            current_version = self.version_manager.get_current_version()
            should_promote = self._should_promote(
                model_type="forecast",
                new_metrics=metrics,
                current_version=current_version
            )

            if should_promote and self.config["forecast"]["auto_promote"]:
                print(f"\n🚀 Auto-promoting version {version_id} to production")
                self.version_manager.promote_to_production(version_id)
            else:
                print(f"\n⏸️  Version {version_id} saved but not promoted (no improvement)")

            return True, metrics

        except Exception as e:
            print(f"\n❌ Error retraining forecast model: {str(e)}")
            import traceback
            traceback.print_exc()
            return False, {}

    def retrain_inventory_model(self) -> Tuple[bool, Dict]:
        """
        Retrain inventory prediction model.

        Returns:
            Tuple of (success, metrics)
        """
        print("\n" + "="*80)
        print("🔄 RETRAINING INVENTORY PREDICTION MODEL")
        print("="*80)

        try:
            # Extract fresh data
            print("\n📊 Extracting product and sales data...")
            # The inventory model training script handles data extraction internally

            # Train new model
            print("\n🤖 Training Random Forest model...")
            metrics = train_inventory_model(force_retrain=True)

            # Save new version
            print("\n💾 Saving new model version...")
            version_id = self.version_manager.save_model_version(
                model_type="inventory",
                model_files={
                    "inventory_model.pkl": "models/inventory_model.pkl",
                    "inventory_metadata.pkl": "models/inventory_metadata.pkl"
                },
                metrics=metrics,
                metadata={
                    "retrained_at": datetime.now().isoformat(),
                    "auto_retrain": True
                }
            )

            # Compare and promote
            current_version = self.version_manager.get_current_version()
            should_promote = self._should_promote(
                model_type="inventory",
                new_metrics=metrics,
                current_version=current_version
            )

            if should_promote and self.config["inventory"]["auto_promote"]:
                print(f"\n🚀 Auto-promoting version {version_id} to production")
                self.version_manager.promote_to_production(version_id)
            else:
                print(f"\n⏸️  Version {version_id} saved but not promoted")

            return True, metrics

        except Exception as e:
            print(f"\n❌ Error retraining inventory model: {str(e)}")
            import traceback
            traceback.print_exc()
            return False, {}

    def retrain_recommendation_model(self) -> Tuple[bool, Dict]:
        """
        Retrain product recommendation model.

        Returns:
            Tuple of (success, metrics)
        """
        print("\n" + "="*80)
        print("🔄 RETRAINING RECOMMENDATION MODEL")
        print("="*80)

        try:
            # Extract fresh data
            print("\n📊 Extracting transaction data...")
            df = extract_transaction_items()

            if len(df) < 100:
                print(f"❌ Insufficient transaction data: {len(df)} transactions (minimum: 100)")
                return False, {}

            print(f"✓ Extracted {len(df)} transactions")

            # Train new model
            print("\n🤖 Training Apriori model...")
            metrics = train_recommendation_model(force_retrain=True)

            # Save new version
            print("\n💾 Saving new model version...")
            version_id = self.version_manager.save_model_version(
                model_type="recommendations",
                model_files={
                    "recommendation_itemsets.pkl": "models/recommendation_itemsets.pkl",
                    "recommendation_rules.pkl": "models/recommendation_rules.pkl",
                    "recommendation_lookup.pkl": "models/recommendation_lookup.pkl",
                    "product_mapping.pkl": "models/product_mapping.pkl",
                    "recommendation_metadata.pkl": "models/recommendation_metadata.pkl"
                },
                metrics=metrics,
                metadata={
                    "num_transactions": len(df),
                    "retrained_at": datetime.now().isoformat(),
                    "auto_retrain": True
                }
            )

            # Compare and promote
            current_version = self.version_manager.get_current_version()
            should_promote = self._should_promote(
                model_type="recommendations",
                new_metrics=metrics,
                current_version=current_version
            )

            if should_promote and self.config["recommendations"]["auto_promote"]:
                print(f"\n🚀 Auto-promoting version {version_id} to production")
                self.version_manager.promote_to_production(version_id)
            else:
                print(f"\n⏸️  Version {version_id} saved but not promoted")

            return True, metrics

        except Exception as e:
            print(f"\n❌ Error retraining recommendation model: {str(e)}")
            import traceback
            traceback.print_exc()
            return False, {}

    def _should_promote(
        self,
        model_type: str,
        new_metrics: Dict,
        current_version: str
    ) -> bool:
        """
        Determine if new model should be promoted to production.

        Args:
            model_type: Type of model
            new_metrics: Metrics for newly trained model
            current_version: Current production version ID

        Returns:
            True if should promote
        """
        if not current_version:
            print("  ℹ️  No current production version, will promote new model")
            return True

        # Get current model metrics
        versions = self.version_manager.list_versions(model_type)
        current = next((v for v in versions if v["version_id"] == current_version), None)

        if not current:
            print("  ℹ️  Current version not found, will promote new model")
            return True

        current_metrics = current.get("metrics", {})
        config = self.config.get(model_type, {})
        metric_name = config.get("metric")
        metric_direction = config.get("metric_direction", "lower")
        threshold = config.get("improvement_threshold", 0.0)

        if metric_name not in new_metrics or metric_name not in current_metrics:
            print(f"  ⚠️  Metric '{metric_name}' not found in metrics, cannot compare")
            return False

        new_value = new_metrics[metric_name]
        current_value = current_metrics[metric_name]

        # Calculate improvement
        if metric_direction == "lower":
            # Lower is better (e.g., MAPE, RMSE)
            improvement = current_value - new_value
            improved = new_value < current_value
        else:
            # Higher is better (e.g., R2, confidence)
            improvement = new_value - current_value
            improved = new_value > current_value

        improvement_pct = (improvement / abs(current_value) * 100) if current_value != 0 else 0

        print(f"\n📊 Performance Comparison:")
        print(f"  Metric: {metric_name}")
        print(f"  Current: {current_value:.4f}")
        print(f"  New: {new_value:.4f}")
        print(f"  Change: {improvement:+.4f} ({improvement_pct:+.2f}%)")
        print(f"  Threshold: {threshold}%")

        if improved and abs(improvement_pct) >= threshold:
            print(f"  ✅ NEW MODEL IS BETTER! Will promote.")
            return True
        else:
            print(f"  ❌ New model not better, will not promote")
            return False

    def run_full_retrain(self) -> Dict:
        """
        Run full retraining pipeline for all enabled models.

        Returns:
            Results dictionary with success status and metrics
        """
        print("\n" + "🎯" * 40)
        print("AUTOMATED MODEL RETRAINING PIPELINE")
        print("🎯" * 40)
        print(f"Started: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")

        # Retrain forecast model
        if self.config["forecast"]["enabled"]:
            success, metrics = self.retrain_forecast_model()
            self.results["models"]["forecast"] = {
                "success": success,
                "metrics": metrics
            }

        # Retrain inventory model
        if self.config["inventory"]["enabled"]:
            success, metrics = self.retrain_inventory_model()
            self.results["models"]["inventory"] = {
                "success": success,
                "metrics": metrics
            }

        # Retrain recommendation model
        if self.config["recommendations"]["enabled"]:
            success, metrics = self.retrain_recommendation_model()
            self.results["models"]["recommendations"] = {
                "success": success,
                "metrics": metrics
            }

        # Cleanup old versions
        if self.config["cleanup"]["enabled"]:
            print("\n" + "="*80)
            print("🧹 CLEANUP OLD VERSIONS")
            print("="*80)
            self.version_manager.cleanup_old_versions(
                keep_last_n=self.config["cleanup"]["keep_last_n_versions"]
            )

        # Print summary
        self._print_summary()

        # Save results
        self._save_results()

        return self.results

    def _print_summary(self):
        """Print retraining summary."""
        print("\n" + "="*80)
        print("📋 RETRAINING SUMMARY")
        print("="*80)

        for model_type, result in self.results["models"].items():
            status = "✅ SUCCESS" if result["success"] else "❌ FAILED"
            print(f"\n{model_type.upper()}: {status}")

            if result["success"] and result["metrics"]:
                print("  Metrics:")
                for metric, value in result["metrics"].items():
                    if isinstance(value, float):
                        print(f"    {metric}: {value:.4f}")
                    else:
                        print(f"    {metric}: {value}")

        print(f"\nCompleted: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        print("="*80)

    def _save_results(self):
        """Save retraining results to file."""
        results_dir = "logs"
        os.makedirs(results_dir, exist_ok=True)

        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        results_file = os.path.join(results_dir, f"retrain_results_{timestamp}.json")

        with open(results_file, 'w') as f:
            json.dump(self.results, f, indent=2)

        print(f"\n💾 Results saved to: {results_file}")


def main():
    """Main entry point for retraining pipeline."""
    pipeline = ModelRetrainingPipeline()
    results = pipeline.run_full_retrain()

    # Exit with appropriate code
    all_success = all(r["success"] for r in results["models"].values())
    sys.exit(0 if all_success else 1)


if __name__ == "__main__":
    main()
