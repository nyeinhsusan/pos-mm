"""
Model Performance Monitoring

Tracks model performance over time, detects drift, and generates alerts.

Author: Dev Agent
Date: April 25, 2026
"""

import os
import sys
import json
import argparse
from datetime import datetime, timedelta
from typing import Dict, List, Optional
import matplotlib.pyplot as plt
import seaborn as sns

# Add to path
sys.path.append(os.path.dirname(__file__))

from utils.model_versioning import ModelVersionManager


class ModelMonitor:
    """
    Monitor model performance and detect issues.

    Features:
    - Performance trending
    - Drift detection
    - Alert generation
    - Visualization
    """

    def __init__(self):
        """Initialize model monitor."""
        self.version_manager = ModelVersionManager()

    def get_performance_trends(self, model_type: str, days: int = 30) -> List[Dict]:
        """
        Get performance trends for a model type.

        Args:
            model_type: Model type (forecast, inventory, recommendations)
            days: Number of days to look back

        Returns:
            List of performance records
        """
        history = self.version_manager.get_performance_history(model_type)

        # Filter by date
        cutoff = datetime.now() - timedelta(days=days)
        filtered = [
            record for record in history
            if datetime.fromisoformat(record["timestamp"]) >= cutoff
        ]

        return filtered

    def detect_drift(self, model_type: str, metric: str, threshold: float = 10.0) -> Dict:
        """
        Detect performance drift in model.

        Args:
            model_type: Model type
            metric: Metric to check
            threshold: Percentage degradation threshold for alert

        Returns:
            Drift detection results
        """
        history = self.get_performance_trends(model_type, days=30)

        if len(history) < 2:
            return {
                "drift_detected": False,
                "message": "Insufficient history for drift detection"
            }

        # Compare latest vs baseline (first record)
        baseline = history[0]["metrics"].get(metric)
        latest = history[-1]["metrics"].get(metric)

        if baseline is None or latest is None:
            return {
                "drift_detected": False,
                "message": f"Metric '{metric}' not found"
            }

        # Calculate degradation
        # Assume lower is better for most metrics
        degradation = ((latest - baseline) / baseline * 100)

        drift_detected = abs(degradation) > threshold

        return {
            "drift_detected": drift_detected,
            "model_type": model_type,
            "metric": metric,
            "baseline_value": baseline,
            "latest_value": latest,
            "degradation_pct": degradation,
            "threshold_pct": threshold,
            "baseline_version": history[0]["version_id"],
            "latest_version": history[-1]["version_id"],
            "message": f"{'⚠️ DRIFT DETECTED' if drift_detected else '✓ No drift'}: {degradation:+.2f}%"
        }

    def generate_report(self, output_file: Optional[str] = None) -> Dict:
        """
        Generate comprehensive monitoring report.

        Args:
            output_file: Optional file to save report

        Returns:
            Report dictionary
        """
        report = {
            "generated_at": datetime.now().isoformat(),
            "models": {}
        }

        for model_type in ["forecast", "inventory", "recommendations"]:
            print(f"\n{'='*80}")
            print(f"MONITORING REPORT: {model_type.upper()}")
            print(f"{'='*80}")

            # Get versions
            versions = self.version_manager.list_versions(model_type)
            current_version = self.version_manager.get_current_version()

            # Get performance history
            history = self.get_performance_trends(model_type, days=30)

            model_report = {
                "current_version": current_version,
                "total_versions": len(versions),
                "retraining_count_30d": len(history),
                "drift_checks": {}
            }

            print(f"\nCurrent Version: {current_version}")
            print(f"Total Versions: {len(versions)}")
            print(f"Retrainings (30 days): {len(history)}")

            # Drift detection for key metrics
            if model_type == "forecast":
                metrics_to_check = ["MAPE", "RMSE"]
            elif model_type == "inventory":
                metrics_to_check = ["R2", "MAE"]
            else:
                metrics_to_check = ["average_confidence", "coverage"]

            print(f"\nDrift Detection:")
            for metric in metrics_to_check:
                drift_result = self.detect_drift(model_type, metric)
                model_report["drift_checks"][metric] = drift_result
                print(f"  {metric}: {drift_result['message']}")

            # Recent performance
            if history:
                latest = history[-1]
                print(f"\nLatest Performance ({latest['version_id']}):")
                for metric, value in latest["metrics"].items():
                    if isinstance(value, float):
                        print(f"  {metric}: {value:.4f}")
                    else:
                        print(f"  {metric}: {value}")

            report["models"][model_type] = model_report

        # Save report if requested
        if output_file:
            os.makedirs(os.path.dirname(output_file) or ".", exist_ok=True)
            with open(output_file, 'w') as f:
                json.dump(report, f, indent=2)
            print(f"\n💾 Report saved to: {output_file}")

        return report

    def plot_performance_trends(self, model_type: str, output_dir: str = "logs/charts"):
        """
        Generate performance trend visualizations.

        Args:
            model_type: Model type
            output_dir: Directory to save charts
        """
        history = self.get_performance_trends(model_type, days=90)

        if len(history) < 2:
            print(f"⚠️  Insufficient history for {model_type} (need at least 2 data points)")
            return

        os.makedirs(output_dir, exist_ok=True)

        # Extract data
        timestamps = [datetime.fromisoformat(r["timestamp"]) for r in history]
        metrics = history[0]["metrics"].keys()

        # Create plots for each metric
        for metric in metrics:
            values = [r["metrics"].get(metric) for r in history]

            # Skip if not all numeric
            if not all(isinstance(v, (int, float)) for v in values if v is not None):
                continue

            # Create plot
            plt.figure(figsize=(12, 6))
            plt.plot(timestamps, values, marker='o', linewidth=2, markersize=8)
            plt.title(f"{model_type.upper()} - {metric} Over Time", fontsize=14, fontweight='bold')
            plt.xlabel("Date", fontsize=12)
            plt.ylabel(metric, fontsize=12)
            plt.grid(True, alpha=0.3)
            plt.xticks(rotation=45)
            plt.tight_layout()

            # Save
            filename = f"{model_type}_{metric.lower()}_trend.png"
            filepath = os.path.join(output_dir, filename)
            plt.savefig(filepath, dpi=150)
            plt.close()

            print(f"  ✓ Saved {filename}")

    def check_health(self) -> Dict:
        """
        Quick health check of all models.

        Returns:
            Health status dictionary
        """
        health = {
            "timestamp": datetime.now().isoformat(),
            "overall_status": "healthy",
            "models": {}
        }

        for model_type in ["forecast", "inventory", "recommendations"]:
            # Check if model exists
            current = self.version_manager.get_current_version()
            has_model = current is not None

            # Check last retrain time
            history = self.version_manager.get_performance_history(model_type)
            if history:
                last_retrain = datetime.fromisoformat(history[-1]["timestamp"])
                days_since = (datetime.now() - last_retrain).days
                needs_retrain = days_since > 30  # Alert if > 30 days
            else:
                days_since = None
                needs_retrain = True

            # Drift check
            drift_results = []
            if model_type == "forecast":
                drift_results.append(self.detect_drift(model_type, "MAPE"))
            elif model_type == "inventory":
                drift_results.append(self.detect_drift(model_type, "R2"))
            else:
                drift_results.append(self.detect_drift(model_type, "average_confidence"))

            has_drift = any(d.get("drift_detected", False) for d in drift_results)

            # Determine status
            if not has_model:
                status = "critical"
                health["overall_status"] = "critical"
            elif has_drift:
                status = "warning"
                if health["overall_status"] == "healthy":
                    health["overall_status"] = "warning"
            elif needs_retrain:
                status = "warning"
                if health["overall_status"] == "healthy":
                    health["overall_status"] = "warning"
            else:
                status = "healthy"

            health["models"][model_type] = {
                "status": status,
                "has_model": has_model,
                "current_version": current,
                "days_since_retrain": days_since,
                "needs_retrain": needs_retrain,
                "has_drift": has_drift,
                "drift_details": drift_results
            }

        return health


def main():
    """Main entry point for monitoring."""
    parser = argparse.ArgumentParser(description="Model Performance Monitoring")

    parser.add_argument(
        "--report",
        action="store_true",
        help="Generate comprehensive monitoring report"
    )

    parser.add_argument(
        "--health",
        action="store_true",
        help="Quick health check of all models"
    )

    parser.add_argument(
        "--drift",
        choices=["forecast", "inventory", "recommendations"],
        help="Check drift for specific model"
    )

    parser.add_argument(
        "--plot",
        choices=["forecast", "inventory", "recommendations"],
        help="Generate performance trend plots"
    )

    parser.add_argument(
        "--output",
        help="Output file for report"
    )

    args = parser.parse_args()

    monitor = ModelMonitor()

    if args.health:
        health = monitor.check_health()
        print("\n" + "="*80)
        print("MODEL HEALTH CHECK")
        print("="*80)
        print(f"Overall Status: {health['overall_status'].upper()}")

        for model_type, status in health["models"].items():
            icon = "✅" if status["status"] == "healthy" else "⚠️" if status["status"] == "warning" else "❌"
            print(f"\n{icon} {model_type.upper()}: {status['status'].upper()}")
            print(f"  Current Version: {status['current_version']}")
            if status['days_since_retrain'] is not None:
                print(f"  Last Retrain: {status['days_since_retrain']} days ago")
            if status['needs_retrain']:
                print(f"  ⚠️  Needs retraining!")
            if status['has_drift']:
                print(f"  ⚠️  Performance drift detected!")

    elif args.report:
        output_file = args.output or f"logs/monitoring_report_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
        monitor.generate_report(output_file)

    elif args.drift:
        print(f"\n{'='*80}")
        print(f"DRIFT DETECTION: {args.drift.upper()}")
        print(f"{'='*80}")

        if args.drift == "forecast":
            metrics = ["MAPE", "RMSE", "MAE"]
        elif args.drift == "inventory":
            metrics = ["R2", "MAE", "RMSE"]
        else:
            metrics = ["average_confidence", "coverage", "num_rules"]

        for metric in metrics:
            result = monitor.detect_drift(args.drift, metric)
            print(f"\n{metric}:")
            print(f"  {result['message']}")
            if result.get("drift_detected"):
                print(f"  Baseline: {result['baseline_value']:.4f} ({result['baseline_version']})")
                print(f"  Current: {result['latest_value']:.4f} ({result['latest_version']})")

    elif args.plot:
        print(f"\n{'='*80}")
        print(f"GENERATING PERFORMANCE CHARTS: {args.plot.upper()}")
        print(f"{'='*80}\n")
        monitor.plot_performance_trends(args.plot)

    else:
        parser.print_help()


if __name__ == "__main__":
    main()
