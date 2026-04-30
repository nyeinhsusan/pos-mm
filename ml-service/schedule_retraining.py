"""
Model Retraining Scheduler

Provides scheduling capabilities for automated model retraining.
Can be run manually or via cron/systemd timers.

Author: Dev Agent
Date: April 25, 2026
"""

import os
import sys
import json
import argparse
from datetime import datetime, timedelta
from typing import Optional

# Add to path
sys.path.append(os.path.dirname(__file__))

from retrain_all_models import ModelRetrainingPipeline


class RetrainingScheduler:
    """
    Scheduler for automated model retraining.

    Supports different schedules for different models:
    - Daily: Recommendations (fast, frequent updates valuable)
    - Weekly: Forecast and Inventory (slower, less frequent needed)
    - Monthly: Full retrain with hyperparameter tuning
    """

    def __init__(self, config_path: str = "retraining_config.json"):
        """Initialize scheduler."""
        self.config_path = config_path
        self.state_file = "logs/retraining_state.json"
        self.state = self._load_state()

    def _load_state(self) -> dict:
        """Load retraining state (last run times)."""
        if os.path.exists(self.state_file):
            with open(self.state_file, 'r') as f:
                return json.load(f)
        return {
            "last_retrain": {},
            "next_scheduled": {}
        }

    def _save_state(self):
        """Save retraining state."""
        os.makedirs(os.path.dirname(self.state_file), exist_ok=True)
        with open(self.state_file, 'w') as f:
            json.dump(self.state, f, indent=2)

    def should_retrain(self, model_type: str, schedule: str) -> bool:
        """
        Check if model should be retrained based on schedule.

        Args:
            model_type: Type of model (forecast, inventory, recommendations)
            schedule: Schedule frequency (daily, weekly, monthly)

        Returns:
            True if should retrain now
        """
        if model_type not in self.state["last_retrain"]:
            print(f"  ℹ️  {model_type}: Never retrained, will retrain now")
            return True

        last_retrain = datetime.fromisoformat(self.state["last_retrain"][model_type])
        now = datetime.now()
        time_since = now - last_retrain

        schedule_map = {
            "daily": timedelta(days=1),
            "weekly": timedelta(weeks=1),
            "monthly": timedelta(days=30)
        }

        threshold = schedule_map.get(schedule, timedelta(weeks=1))

        if time_since >= threshold:
            print(f"  ✅ {model_type}: Last retrain {time_since.days} days ago, will retrain")
            return True
        else:
            days_until = (threshold - time_since).days
            print(f"  ⏸️  {model_type}: Last retrain {time_since.days} days ago, next in {days_until} days")
            return False

    def run_scheduled_retrain(self, force: bool = False):
        """
        Run retraining for models that are due based on schedule.

        Args:
            force: Force retrain all models regardless of schedule
        """
        print("\n" + "📅" * 40)
        print("SCHEDULED MODEL RETRAINING CHECK")
        print("📅" * 40)
        print(f"Time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")

        # Load config
        with open(self.config_path, 'r') as f:
            config = json.load(f)

        schedule_config = config.get("schedule", {})

        # Check each model
        models_to_retrain = []

        for model_type in ["forecast", "inventory", "recommendations"]:
            schedule = schedule_config.get(model_type, "weekly")
            print(f"\n{model_type.upper()} (Schedule: {schedule})")

            if force or self.should_retrain(model_type, schedule):
                models_to_retrain.append(model_type)

        # Run retraining if needed
        if models_to_retrain:
            print(f"\n🔄 Retraining models: {', '.join(models_to_retrain)}")

            # Create custom config for selective retraining
            custom_config = config.copy()
            custom_config["forecast"]["enabled"] = "forecast" in models_to_retrain
            custom_config["inventory"]["enabled"] = "inventory" in models_to_retrain
            custom_config["recommendations"]["enabled"] = "recommendations" in models_to_retrain

            # Save temporary config
            temp_config = "temp_retraining_config.json"
            with open(temp_config, 'w') as f:
                json.dump(custom_config, f)

            # Run pipeline
            pipeline = ModelRetrainingPipeline(temp_config)
            results = pipeline.run_full_retrain()

            # Update state
            for model_type in models_to_retrain:
                if results["models"].get(model_type, {}).get("success"):
                    self.state["last_retrain"][model_type] = datetime.now().isoformat()

            self._save_state()

            # Cleanup temp config
            if os.path.exists(temp_config):
                os.remove(temp_config)

        else:
            print("\n✓ No models need retraining at this time")

        print("\n" + "="*80)


def generate_cron_examples():
    """Generate example cron job configurations."""
    print("\n" + "="*80)
    print("CRON JOB EXAMPLES")
    print("="*80)

    examples = [
        {
            "schedule": "Daily at 2 AM",
            "cron": "0 2 * * *",
            "command": "cd /path/to/ml-service && python3 schedule_retraining.py"
        },
        {
            "schedule": "Weekly on Sunday at 3 AM",
            "cron": "0 3 * * 0",
            "command": "cd /path/to/ml-service && python3 schedule_retraining.py"
        },
        {
            "schedule": "Monthly on 1st at 4 AM",
            "cron": "0 4 1 * *",
            "command": "cd /path/to/ml-service && python3 schedule_retraining.py --force"
        }
    ]

    print("\nTo add to crontab, run: crontab -e\n")

    for example in examples:
        print(f"# {example['schedule']}")
        print(f"{example['cron']} {example['command']}")
        print()

    print("="*80)


def generate_systemd_timer():
    """Generate systemd timer configuration."""
    timer_content = """# /etc/systemd/system/ml-retrain.timer
[Unit]
Description=ML Model Retraining Timer
Requires=ml-retrain.service

[Timer]
# Run daily at 2 AM
OnCalendar=daily
OnCalendar=02:00
Persistent=true

[Install]
WantedBy=timers.target
"""

    service_content = """# /etc/systemd/system/ml-retrain.service
[Unit]
Description=ML Model Retraining Service
After=network.target mysql.service

[Service]
Type=oneshot
User=pos-user
WorkingDirectory=/path/to/pos-mm/ml-service
Environment="PATH=/path/to/ml-service/venv/bin:/usr/bin"
ExecStart=/path/to/ml-service/venv/bin/python3 schedule_retraining.py
StandardOutput=append:/var/log/ml-retrain.log
StandardError=append:/var/log/ml-retrain-error.log

[Install]
WantedBy=multi-user.target
"""

    print("\n" + "="*80)
    print("SYSTEMD TIMER CONFIGURATION")
    print("="*80)
    print("\nTimer file:")
    print(timer_content)
    print("\nService file:")
    print(service_content)
    print("\nTo enable:")
    print("  sudo systemctl enable ml-retrain.timer")
    print("  sudo systemctl start ml-retrain.timer")
    print("  sudo systemctl status ml-retrain.timer")
    print("\n" + "="*80)


def main():
    """Main entry point for scheduler."""
    parser = argparse.ArgumentParser(
        description="Model Retraining Scheduler",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Run scheduled check (only retrain models that are due)
  python schedule_retraining.py

  # Force retrain all models
  python schedule_retraining.py --force

  # Generate cron examples
  python schedule_retraining.py --cron-examples

  # Generate systemd timer config
  python schedule_retraining.py --systemd-timer
        """
    )

    parser.add_argument(
        "--force",
        action="store_true",
        help="Force retrain all models regardless of schedule"
    )

    parser.add_argument(
        "--cron-examples",
        action="store_true",
        help="Generate example cron job configurations"
    )

    parser.add_argument(
        "--systemd-timer",
        action="store_true",
        help="Generate systemd timer configuration"
    )

    parser.add_argument(
        "--config",
        default="retraining_config.json",
        help="Path to retraining configuration file"
    )

    args = parser.parse_args()

    # Handle special commands
    if args.cron_examples:
        generate_cron_examples()
        return

    if args.systemd_timer:
        generate_systemd_timer()
        return

    # Run scheduled retraining
    scheduler = RetrainingScheduler(args.config)
    scheduler.run_scheduled_retrain(force=args.force)


if __name__ == "__main__":
    main()
