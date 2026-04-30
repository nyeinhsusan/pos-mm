"""
Model Rollback Utility

Quick rollback to previous model versions in case of issues.

Author: Dev Agent
Date: April 25, 2026
"""

import os
import sys
import argparse
from datetime import datetime
from typing import Optional

# Add to path
sys.path.append(os.path.dirname(__file__))

from utils.model_versioning import ModelVersionManager


class ModelRollback:
    """
    Utility for rolling back to previous model versions.

    Use cases:
    - New model performs worse in production
    - Bugs discovered in new model
    - Emergency recovery
    """

    def __init__(self):
        """Initialize rollback utility."""
        self.version_manager = ModelVersionManager()

    def list_available_versions(self, model_type: Optional[str] = None):
        """
        List all available versions for rollback.

        Args:
            model_type: Optional filter by model type
        """
        versions = self.version_manager.list_versions(model_type)
        current = self.version_manager.get_current_version()

        print("\n" + "="*80)
        print("AVAILABLE MODEL VERSIONS")
        print("="*80)

        if not versions:
            print("\n  No versions found")
            return

        for version in reversed(versions):  # Latest first
            is_current = version["version_id"] == current
            marker = "🚀 [CURRENT]" if is_current else "  "

            print(f"\n{marker} Version: {version['version_id']}")
            print(f"  Model Type: {version['model_type']}")
            print(f"  Created: {version['created_at']}")

            # Print metrics
            print("  Metrics:")
            for metric, value in version['metrics'].items():
                if isinstance(value, float):
                    print(f"    {metric}: {value:.4f}")
                else:
                    print(f"    {metric}: {value}")

    def rollback_to_previous(self, model_type: str) -> bool:
        """
        Rollback to the previous version of a model.

        Args:
            model_type: Model type to rollback

        Returns:
            True if successful
        """
        versions = self.version_manager.list_versions(model_type)
        current = self.version_manager.get_current_version()

        if not versions:
            print(f"❌ No versions found for {model_type}")
            return False

        if len(versions) < 2:
            print(f"❌ Only one version exists for {model_type}, cannot rollback")
            return False

        # Find current version index
        current_idx = None
        for i, v in enumerate(versions):
            if v["version_id"] == current:
                current_idx = i
                break

        if current_idx is None or current_idx == 0:
            print(f"❌ Cannot determine previous version")
            return False

        previous_version = versions[current_idx - 1]
        previous_id = previous_version["version_id"]

        print(f"\n🔄 Rolling back {model_type}:")
        print(f"  From: {current}")
        print(f"  To: {previous_id}")

        # Confirm
        confirm = input("\nConfirm rollback? (yes/no): ")
        if confirm.lower() != "yes":
            print("❌ Rollback cancelled")
            return False

        # Perform rollback
        success = self.version_manager.rollback_to_version(previous_id)

        if success:
            # Log rollback
            self._log_rollback(model_type, current, previous_id)

        return success

    def rollback_to_specific(self, version_id: str) -> bool:
        """
        Rollback to a specific version ID.

        Args:
            version_id: Version ID to rollback to

        Returns:
            True if successful
        """
        versions = self.version_manager.list_versions()
        version = next((v for v in versions if v["version_id"] == version_id), None)

        if not version:
            print(f"❌ Version {version_id} not found")
            return False

        current = self.version_manager.get_current_version()

        print(f"\n🔄 Rolling back to {version_id}:")
        print(f"  Model Type: {version['model_type']}")
        print(f"  Created: {version['created_at']}")
        print(f"  Current Version: {current}")

        # Show metrics
        print("\n  Metrics:")
        for metric, value in version['metrics'].items():
            if isinstance(value, float):
                print(f"    {metric}: {value:.4f}")
            else:
                print(f"    {metric}: {value}")

        # Confirm
        confirm = input("\nConfirm rollback? (yes/no): ")
        if confirm.lower() != "yes":
            print("❌ Rollback cancelled")
            return False

        # Perform rollback
        success = self.version_manager.rollback_to_version(version_id)

        if success:
            self._log_rollback(version['model_type'], current, version_id)

        return success

    def _log_rollback(self, model_type: str, from_version: str, to_version: str):
        """Log rollback event."""
        log_dir = "logs"
        os.makedirs(log_dir, exist_ok=True)

        log_file = os.path.join(log_dir, "rollback_history.log")

        with open(log_file, 'a') as f:
            f.write(f"{datetime.now().isoformat()} | {model_type} | {from_version} -> {to_version}\n")

        print(f"\n✅ Rollback logged to {log_file}")

    def emergency_rollback_all(self) -> bool:
        """
        Emergency rollback all models to previous versions.

        Returns:
            True if all successful
        """
        print("\n" + "🚨" * 40)
        print("EMERGENCY ROLLBACK - ALL MODELS")
        print("🚨" * 40)

        confirm = input("\n⚠️  This will rollback ALL models to their previous versions.\n"
                       "Are you absolutely sure? Type 'ROLLBACK' to confirm: ")

        if confirm != "ROLLBACK":
            print("❌ Emergency rollback cancelled")
            return False

        results = {}

        for model_type in ["forecast", "inventory", "recommendations"]:
            print(f"\n{'='*80}")
            print(f"Rolling back {model_type}...")
            print(f"{'='*80}")

            success = self.rollback_to_previous(model_type)
            results[model_type] = success

        # Summary
        print("\n" + "="*80)
        print("EMERGENCY ROLLBACK SUMMARY")
        print("="*80)

        all_success = all(results.values())

        for model_type, success in results.items():
            status = "✅ SUCCESS" if success else "❌ FAILED"
            print(f"{model_type}: {status}")

        return all_success


def main():
    """Main entry point for rollback utility."""
    parser = argparse.ArgumentParser(
        description="Model Rollback Utility",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # List all available versions
  python rollback_model.py --list

  # List versions for specific model
  python rollback_model.py --list --model forecast

  # Rollback to previous version
  python rollback_model.py --previous --model forecast

  # Rollback to specific version
  python rollback_model.py --version v3_20260425_120000

  # Emergency rollback all models
  python rollback_model.py --emergency
        """
    )

    parser.add_argument(
        "--list",
        action="store_true",
        help="List all available versions"
    )

    parser.add_argument(
        "--model",
        choices=["forecast", "inventory", "recommendations"],
        help="Model type filter"
    )

    parser.add_argument(
        "--previous",
        action="store_true",
        help="Rollback to previous version"
    )

    parser.add_argument(
        "--version",
        help="Rollback to specific version ID"
    )

    parser.add_argument(
        "--emergency",
        action="store_true",
        help="Emergency rollback all models to previous versions"
    )

    args = parser.parse_args()

    rollback = ModelRollback()

    if args.list:
        rollback.list_available_versions(args.model)

    elif args.previous:
        if not args.model:
            print("❌ --model required for --previous")
            return

        rollback.rollback_to_previous(args.model)

    elif args.version:
        rollback.rollback_to_specific(args.version)

    elif args.emergency:
        rollback.emergency_rollback_all()

    else:
        parser.print_help()


if __name__ == "__main__":
    main()
