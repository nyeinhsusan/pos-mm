"""
Model Versioning System

Handles versioning, storage, and management of ML models across retraining cycles.
Enables rollback to previous versions and tracks performance history.

Author: Dev Agent
Date: April 25, 2026
"""

import os
import json
import shutil
import joblib
from datetime import datetime
from typing import Dict, Any, Optional, List


class ModelVersionManager:
    """
    Manages model versions, metadata, and rollback capabilities.

    Directory structure:
    models/
    ├── current/                    # Active models in production
    │   ├── sales_forecast_model.pkl
    │   ├── inventory_model.pkl
    │   └── recommendation_*.pkl
    ├── versions/                   # Historical versions
    │   ├── v1_20260425_120000/
    │   ├── v2_20260426_120000/
    │   └── v3_20260427_120000/
    └── metadata/                   # Version metadata
        ├── version_history.json
        └── performance_log.json
    """

    def __init__(self, base_path: str = "models"):
        """
        Initialize version manager.

        Args:
            base_path: Base directory for model storage
        """
        self.base_path = base_path
        self.current_path = os.path.join(base_path, "current")
        self.versions_path = os.path.join(base_path, "versions")
        self.metadata_path = os.path.join(base_path, "metadata")

        # Create directories if they don't exist
        os.makedirs(self.current_path, exist_ok=True)
        os.makedirs(self.versions_path, exist_ok=True)
        os.makedirs(self.metadata_path, exist_ok=True)

        # Metadata files
        self.version_history_file = os.path.join(self.metadata_path, "version_history.json")
        self.performance_log_file = os.path.join(self.metadata_path, "performance_log.json")

        # Initialize metadata files if they don't exist
        self._initialize_metadata()

    def _initialize_metadata(self):
        """Initialize metadata files if they don't exist."""
        if not os.path.exists(self.version_history_file):
            self._save_json(self.version_history_file, {
                "current_version": None,
                "versions": []
            })

        if not os.path.exists(self.performance_log_file):
            self._save_json(self.performance_log_file, {
                "forecast": [],
                "inventory": [],
                "recommendations": []
            })

    def _save_json(self, filepath: str, data: Dict):
        """Save JSON data to file."""
        with open(filepath, 'w') as f:
            json.dump(data, f, indent=2)

    def _load_json(self, filepath: str) -> Dict:
        """Load JSON data from file."""
        with open(filepath, 'r') as f:
            return json.load(f)

    def generate_version_id(self) -> str:
        """
        Generate unique version ID based on timestamp.

        Returns:
            Version ID (e.g., "v1_20260425_143022")
        """
        history = self._load_json(self.version_history_file)
        version_number = len(history["versions"]) + 1
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        return f"v{version_number}_{timestamp}"

    def save_model_version(
        self,
        model_type: str,
        model_files: Dict[str, str],
        metrics: Dict[str, Any],
        metadata: Optional[Dict[str, Any]] = None
    ) -> str:
        """
        Save a new model version.

        Args:
            model_type: Type of model (forecast, inventory, recommendations)
            model_files: Dictionary mapping file names to file paths
            metrics: Performance metrics for this version
            metadata: Additional metadata (training config, data info, etc.)

        Returns:
            Version ID
        """
        # Generate version ID
        version_id = self.generate_version_id()
        version_dir = os.path.join(self.versions_path, version_id)
        os.makedirs(version_dir, exist_ok=True)

        # Copy model files to version directory
        for filename, filepath in model_files.items():
            if os.path.exists(filepath):
                dest = os.path.join(version_dir, filename)
                shutil.copy2(filepath, dest)

        # Save version metadata
        version_metadata = {
            "version_id": version_id,
            "model_type": model_type,
            "created_at": datetime.now().isoformat(),
            "files": list(model_files.keys()),
            "metrics": metrics,
            "metadata": metadata or {}
        }

        metadata_file = os.path.join(version_dir, "metadata.json")
        self._save_json(metadata_file, version_metadata)

        # Update version history
        history = self._load_json(self.version_history_file)
        history["versions"].append(version_metadata)
        self._save_json(self.version_history_file, history)

        # Log performance
        self._log_performance(model_type, version_id, metrics)

        print(f"✅ Model version {version_id} saved for {model_type}")
        return version_id

    def _log_performance(self, model_type: str, version_id: str, metrics: Dict[str, Any]):
        """Log performance metrics for a model version."""
        performance_log = self._load_json(self.performance_log_file)

        if model_type not in performance_log:
            performance_log[model_type] = []

        performance_log[model_type].append({
            "version_id": version_id,
            "timestamp": datetime.now().isoformat(),
            "metrics": metrics
        })

        self._save_json(self.performance_log_file, performance_log)

    def promote_to_production(self, version_id: str) -> bool:
        """
        Promote a model version to production (copy to current/).

        Args:
            version_id: Version ID to promote

        Returns:
            True if successful
        """
        version_dir = os.path.join(self.versions_path, version_id)

        if not os.path.exists(version_dir):
            print(f"❌ Version {version_id} not found")
            return False

        # Load version metadata
        metadata_file = os.path.join(version_dir, "metadata.json")
        metadata = self._load_json(metadata_file)

        # Copy all model files to current/
        for filename in metadata["files"]:
            src = os.path.join(version_dir, filename)
            dest = os.path.join(self.current_path, filename)

            if os.path.exists(src):
                shutil.copy2(src, dest)
                print(f"  ✓ Copied {filename} to production")

        # Update current version in history
        history = self._load_json(self.version_history_file)
        history["current_version"] = version_id
        history["promoted_at"] = datetime.now().isoformat()
        self._save_json(self.version_history_file, history)

        print(f"✅ Version {version_id} promoted to production")
        return True

    def rollback_to_version(self, version_id: str) -> bool:
        """
        Rollback to a previous model version.

        Args:
            version_id: Version ID to rollback to

        Returns:
            True if successful
        """
        print(f"🔄 Rolling back to version {version_id}...")
        return self.promote_to_production(version_id)

    def get_current_version(self) -> Optional[str]:
        """Get the current production version ID."""
        history = self._load_json(self.version_history_file)
        return history.get("current_version")

    def list_versions(self, model_type: Optional[str] = None) -> List[Dict]:
        """
        List all versions, optionally filtered by model type.

        Args:
            model_type: Filter by model type (forecast, inventory, recommendations)

        Returns:
            List of version metadata dictionaries
        """
        history = self._load_json(self.version_history_file)
        versions = history["versions"]

        if model_type:
            versions = [v for v in versions if v["model_type"] == model_type]

        return versions

    def compare_versions(self, version_id1: str, version_id2: str) -> Dict:
        """
        Compare metrics between two model versions.

        Args:
            version_id1: First version ID
            version_id2: Second version ID

        Returns:
            Comparison dictionary with metrics differences
        """
        versions = self.list_versions()

        v1 = next((v for v in versions if v["version_id"] == version_id1), None)
        v2 = next((v for v in versions if v["version_id"] == version_id2), None)

        if not v1 or not v2:
            return {"error": "One or both versions not found"}

        comparison = {
            "version_1": version_id1,
            "version_2": version_id2,
            "model_type": v1["model_type"],
            "metrics_v1": v1["metrics"],
            "metrics_v2": v2["metrics"],
            "differences": {}
        }

        # Calculate differences for common metrics
        for metric in v1["metrics"]:
            if metric in v2["metrics"]:
                val1 = v1["metrics"][metric]
                val2 = v2["metrics"][metric]

                if isinstance(val1, (int, float)) and isinstance(val2, (int, float)):
                    diff = val2 - val1
                    pct_change = (diff / val1 * 100) if val1 != 0 else 0

                    comparison["differences"][metric] = {
                        "v1": val1,
                        "v2": val2,
                        "absolute_change": diff,
                        "percent_change": pct_change
                    }

        return comparison

    def get_performance_history(self, model_type: str) -> List[Dict]:
        """
        Get performance history for a model type.

        Args:
            model_type: Model type (forecast, inventory, recommendations)

        Returns:
            List of performance records
        """
        performance_log = self._load_json(self.performance_log_file)
        return performance_log.get(model_type, [])

    def cleanup_old_versions(self, keep_last_n: int = 5) -> int:
        """
        Clean up old model versions, keeping only the last N versions.

        Args:
            keep_last_n: Number of recent versions to keep

        Returns:
            Number of versions deleted
        """
        versions = self.list_versions()

        if len(versions) <= keep_last_n:
            print(f"✓ Only {len(versions)} versions exist, no cleanup needed")
            return 0

        # Sort by creation date (oldest first)
        versions_sorted = sorted(versions, key=lambda v: v["created_at"])

        # Delete oldest versions
        to_delete = versions_sorted[:-keep_last_n]
        deleted_count = 0

        for version in to_delete:
            version_id = version["version_id"]
            version_dir = os.path.join(self.versions_path, version_id)

            if os.path.exists(version_dir):
                shutil.rmtree(version_dir)
                deleted_count += 1
                print(f"  🗑️  Deleted old version: {version_id}")

        print(f"✅ Cleaned up {deleted_count} old versions")
        return deleted_count


# Usage example
if __name__ == "__main__":
    # Initialize version manager
    manager = ModelVersionManager()

    # Example: Save a new version
    # version_id = manager.save_model_version(
    #     model_type="forecast",
    #     model_files={
    #         "sales_forecast_model.pkl": "models/sales_forecast_model.pkl",
    #         "best_forecast_params.pkl": "models/best_forecast_params.pkl"
    #     },
    #     metrics={
    #         "MAPE": 26.41,
    #         "RMSE": 130480,
    #         "MAE": 106429
    #     },
    #     metadata={
    #         "training_days": 144,
    #         "test_days": 36,
    #         "parameters": {"order": "(1,0,1)", "seasonal_order": "(1,0,0,7)"}
    #     }
    # )

    # Example: List all versions
    print("\n📋 All versions:")
    for v in manager.list_versions():
        print(f"  {v['version_id']}: {v['model_type']} - {v['created_at']}")

    # Example: Get current version
    current = manager.get_current_version()
    print(f"\n🚀 Current production version: {current}")
