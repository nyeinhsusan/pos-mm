# Model Retraining Pipeline - User Guide

## Overview

The automated model retraining pipeline provides comprehensive model lifecycle management for all three ML models (Sales Forecast, Inventory Prediction, Product Recommendations).

**Key Features:**
- ✅ Automated retraining with fresh data
- ✅ Model versioning and history
- ✅ Performance comparison and auto-promotion
- ✅ Rollback capability
- ✅ Performance monitoring and drift detection
- ✅ Scheduled retraining (cron/systemd)
- ✅ Comprehensive logging

---

## Quick Start

### 1. Manual Retraining (All Models)

```bash
# Activate virtual environment
source venv/bin/activate

# Run retraining for all models
python retrain_all_models.py
```

This will:
- Extract fresh data from database
- Train new models
- Compare performance with current models
- Auto-promote if performance improves
- Clean up old versions (keep last 5)

### 2. Scheduled Retraining

```bash
# Check which models need retraining (based on schedule)
python schedule_retraining.py

# Force retrain all models regardless of schedule
python schedule_retraining.py --force
```

### 3. Monitor Model Performance

```bash
# Quick health check
python monitor_models.py --health

# Generate comprehensive report
python monitor_models.py --report

# Check drift for specific model
python monitor_models.py --drift forecast

# Generate performance trend plots
python monitor_models.py --plot forecast
```

### 4. Rollback if Needed

```bash
# List available versions
python rollback_model.py --list

# Rollback to previous version
python rollback_model.py --previous --model forecast

# Rollback to specific version
python rollback_model.py --version v3_20260425_120000

# Emergency rollback all models
python rollback_model.py --emergency
```

---

## Architecture

### Directory Structure

```
ml-service/
├── models/
│   ├── current/                    # Production models (symlinks/copies)
│   │   ├── sales_forecast_model.pkl
│   │   ├── inventory_model.pkl
│   │   └── recommendation_*.pkl
│   ├── versions/                   # Historical versions
│   │   ├── v1_20260425_120000/
│   │   │   ├── sales_forecast_model.pkl
│   │   │   ├── metadata.json
│   │   │   └── ...
│   │   ├── v2_20260426_120000/
│   │   └── v3_20260427_120000/
│   └── metadata/                   # Version tracking
│       ├── version_history.json
│       └── performance_log.json
├── logs/
│   ├── retrain_results_*.json      # Retraining results
│   ├── retraining_state.json       # Schedule state
│   ├── rollback_history.log        # Rollback events
│   ├── monitoring_report_*.json    # Monitoring reports
│   └── charts/                     # Performance visualizations
└── retraining_config.json          # Configuration
```

### Components

1. **Model Versioning System** (`utils/model_versioning.py`)
   - Manages model versions
   - Tracks performance history
   - Handles promotion and rollback

2. **Retraining Pipeline** (`retrain_all_models.py`)
   - Orchestrates retraining
   - Compares performance
   - Auto-promotes better models

3. **Scheduler** (`schedule_retraining.py`)
   - Manages retraining schedules
   - Integrates with cron/systemd
   - Tracks last run times

4. **Monitor** (`monitor_models.py`)
   - Performance trending
   - Drift detection
   - Alert generation

5. **Rollback Utility** (`rollback_model.py`)
   - Quick recovery
   - Version management
   - Emergency procedures

---

## Configuration

### Retraining Config (`retraining_config.json`)

```json
{
  "forecast": {
    "enabled": true,
    "auto_promote": true,
    "improvement_threshold": 1.0,    // Promote if MAPE improves by 1%+
    "metric": "MAPE",
    "metric_direction": "lower"       // Lower is better
  },
  "inventory": {
    "enabled": true,
    "auto_promote": true,
    "improvement_threshold": 0.5,     // Promote if R² improves by 0.5%+
    "metric": "R2",
    "metric_direction": "higher"      // Higher is better
  },
  "recommendations": {
    "enabled": true,
    "auto_promote": true,
    "improvement_threshold": 2.0,
    "metric": "average_confidence",
    "metric_direction": "higher"
  },
  "data": {
    "min_days": 90,                   // Minimum data required
    "train_test_split": 0.8
  },
  "cleanup": {
    "enabled": true,
    "keep_last_n_versions": 5         // Keep last 5 versions
  },
  "schedule": {
    "forecast": "weekly",
    "inventory": "weekly",
    "recommendations": "daily"
  }
}
```

### Auto-Promotion Logic

New models are automatically promoted to production if:
1. Performance improves by threshold amount
2. `auto_promote` is enabled
3. Metrics are better than current production model

**Example (Forecast):**
- Current MAPE: 26.41%
- New MAPE: 25.00%
- Improvement: 1.41% → **Promoted** (threshold: 1.0%)

**Example (Inventory):**
- Current R²: 0.9999
- New R²: 0.9998
- Degradation: -0.01% → **Not promoted** (threshold: 0.5%)

---

## Scheduling

### Option 1: Cron Jobs

```bash
# Generate cron examples
python schedule_retraining.py --cron-examples

# Example crontab entries:

# Daily at 2 AM
0 2 * * * cd /path/to/ml-service && python3 schedule_retraining.py

# Weekly on Sunday at 3 AM
0 3 * * 0 cd /path/to/ml-service && python3 schedule_retraining.py

# Monthly on 1st at 4 AM (force retrain)
0 4 1 * * cd /path/to/ml-service && python3 schedule_retraining.py --force
```

### Option 2: Systemd Timer

```bash
# Generate systemd configuration
python schedule_retraining.py --systemd-timer

# Enable and start
sudo systemctl enable ml-retrain.timer
sudo systemctl start ml-retrain.timer

# Check status
sudo systemctl status ml-retrain.timer

# View logs
journalctl -u ml-retrain.service -f
```

### Recommended Schedules

| Model | Frequency | Reason |
|-------|-----------|--------|
| **Forecast** | Weekly | Sales patterns change slowly, weekly update sufficient |
| **Inventory** | Weekly | Inventory patterns stable, weekly is adequate |
| **Recommendations** | Daily | Customer behavior changes frequently, daily update valuable |

---

## Monitoring

### Health Checks

```bash
# Quick health check (all models)
python monitor_models.py --health
```

**Output:**
```
MODEL HEALTH CHECK
==================
Overall Status: HEALTHY

✅ FORECAST: HEALTHY
  Current Version: v3_20260425_120000
  Last Retrain: 2 days ago

✅ INVENTORY: HEALTHY
  Current Version: v2_20260424_120000
  Last Retrain: 3 days ago

⚠️ RECOMMENDATIONS: WARNING
  Current Version: v4_20260420_120000
  Last Retrain: 35 days ago
  ⚠️ Needs retraining!
```

### Performance Reports

```bash
# Generate comprehensive report
python monitor_models.py --report --output logs/report.json
```

**Includes:**
- Current versions
- Retraining frequency
- Drift detection results
- Recent performance metrics

### Drift Detection

```bash
# Check forecast model drift
python monitor_models.py --drift forecast
```

**Alerts when:**
- Performance degrades by >10% from baseline
- Indicates need for retraining or investigation

### Trend Visualization

```bash
# Generate performance charts
python monitor_models.py --plot forecast
```

**Creates:**
- `logs/charts/forecast_mape_trend.png`
- `logs/charts/forecast_rmse_trend.png`
- `logs/charts/forecast_mae_trend.png`

---

## Rollback Procedures

### Scenario 1: New Model Underperforms

```bash
# 1. List recent versions
python rollback_model.py --list --model forecast

# 2. Rollback to previous version
python rollback_model.py --previous --model forecast

# 3. Confirm health
python monitor_models.py --health
```

### Scenario 2: Critical Bug Discovered

```bash
# Rollback to specific known-good version
python rollback_model.py --version v2_20260424_120000
```

### Scenario 3: Complete System Failure

```bash
# Emergency rollback all models
python rollback_model.py --emergency

# Type 'ROLLBACK' to confirm
```

**This will:**
- Rollback all 3 models to previous versions
- Log all rollback events
- Restore last known-good state

---

## Best Practices

### 1. Regular Monitoring

- ✅ Check health weekly: `python monitor_models.py --health`
- ✅ Review reports monthly
- ✅ Monitor drift for production models
- ✅ Set up alerts for critical drift

### 2. Retraining Schedule

- ✅ Start conservative (weekly for all)
- ✅ Increase frequency if data changes rapidly
- ✅ Decrease if models remain stable
- ✅ Force retrain after major data events (holidays, promotions)

### 3. Version Management

- ✅ Keep last 5 versions (default)
- ✅ Tag important versions (high performance)
- ✅ Document rollback reasons
- ✅ Test new versions in staging first (if possible)

### 4. Safety Measures

- ✅ Always test retraining pipeline before scheduling
- ✅ Monitor first automated retraining closely
- ✅ Have rollback plan ready
- ✅ Keep database backups before major retrains

### 5. Performance Thresholds

**Recommended improvement thresholds:**
- Forecast: 1-2% MAPE improvement
- Inventory: 0.5-1% R² improvement
- Recommendations: 2-5% confidence improvement

**Adjust based on:**
- Model stability
- Data volume
- Business criticality

---

## Troubleshooting

### Issue: Retraining Fails

**Symptoms:**
- Error during training
- Models not saved
- Metrics missing

**Solutions:**
```bash
# 1. Check database connectivity
python -c "from utils.db_connection import test_connection; test_connection()"

# 2. Check data availability
python -c "from utils.data_extraction import extract_sales_history; print(len(extract_sales_history()))"

# 3. Check logs
tail -n 100 logs/retrain_results_*.json

# 4. Run individual model training
python train_forecast_model.py
```

### Issue: Auto-Promotion Not Working

**Symptoms:**
- New models trained but not promoted
- Always staying on old version

**Solutions:**
```bash
# 1. Check configuration
cat retraining_config.json

# 2. Check thresholds (may be too strict)
# Edit retraining_config.json and lower thresholds

# 3. Manual promotion
python -c "from utils.model_versioning import ModelVersionManager; \
           m = ModelVersionManager(); \
           m.promote_to_production('v3_20260425_120000')"
```

### Issue: Performance Degradation

**Symptoms:**
- Models performing worse over time
- Drift detected consistently

**Solutions:**
```bash
# 1. Check for data quality issues
# Review recent sales/transactions

# 2. Investigate drift
python monitor_models.py --drift forecast

# 3. Force retrain with fresh data
python retrain_all_models.py

# 4. If still degraded, rollback
python rollback_model.py --previous --model forecast
```

### Issue: Scheduler Not Running

**Symptoms:**
- Models not retraining on schedule
- Cron job not executing

**Solutions:**
```bash
# Check cron logs
grep CRON /var/log/syslog

# Check crontab
crontab -l

# Test manual execution
cd /path/to/ml-service && python3 schedule_retraining.py

# Check permissions
ls -la schedule_retraining.py

# Verify python path in cron
which python3
```

---

## API Integration

The retraining pipeline integrates seamlessly with the Flask ML service. After retraining:

1. **Flask app automatically loads new models** on restart
2. **API endpoints serve new predictions** immediately
3. **Node.js backend caches new predictions**

**To reload without restart:**
```bash
# Send SIGHUP to Flask process (if configured)
kill -HUP <flask-pid>

# Or restart Flask service
sudo systemctl restart ml-service
```

---

## Metrics Glossary

### Forecast Model (SARIMAX)
- **MAPE** (Mean Absolute Percentage Error): Lower is better, <20% excellent
- **RMSE** (Root Mean Squared Error): Prediction error in MMK
- **MAE** (Mean Absolute Error): Average prediction error in MMK

### Inventory Model (Random Forest)
- **R²** (R-squared): 0-1 scale, >0.95 excellent
- **MAE** (Mean Absolute Error): Days until stockout error
- **RMSE**: Prediction error in days

### Recommendation Model (Apriori)
- **Average Confidence**: 0-1 scale, >0.40 good
- **Coverage**: % of products with recommendations, aim for 100%
- **Num Rules**: Number of association rules, more is better

---

## Support & Maintenance

### Logs Location
- Retraining results: `logs/retrain_results_*.json`
- Monitoring reports: `logs/monitoring_report_*.json`
- Rollback history: `logs/rollback_history.log`
- Schedule state: `logs/retraining_state.json`

### Version History
- Version metadata: `models/metadata/version_history.json`
- Performance log: `models/metadata/performance_log.json`

### Cleanup
```bash
# Manual cleanup (keep last 3 versions)
python -c "from utils.model_versioning import ModelVersionManager; \
           m = ModelVersionManager(); \
           m.cleanup_old_versions(keep_last_n=3)"

# Clean old logs (>30 days)
find logs/ -name "*.json" -mtime +30 -delete
find logs/ -name "*.log" -mtime +30 -delete
```

---

## Examples

### Example 1: Weekly Maintenance Routine

```bash
#!/bin/bash
# Weekly maintenance script

echo "=== Weekly ML Model Maintenance ==="

# 1. Health check
echo "1. Health Check..."
python monitor_models.py --health

# 2. Generate report
echo "2. Generating Report..."
python monitor_models.py --report --output logs/weekly_report_$(date +%Y%m%d).json

# 3. Check if retraining needed
echo "3. Checking Schedule..."
python schedule_retraining.py

# 4. Generate trend plots
echo "4. Generating Plots..."
python monitor_models.py --plot forecast
python monitor_models.py --plot inventory
python monitor_models.py --plot recommendations

echo "=== Maintenance Complete ==="
```

### Example 2: Post-Holiday Retraining

```bash
#!/bin/bash
# Force retrain after major event (holiday, promotion, etc.)

echo "=== Post-Event Retraining ==="

# 1. Backup current versions
echo "1. Backing up current versions..."
cp -r models/current models/backup_$(date +%Y%m%d)

# 2. Force retrain all models
echo "2. Force retraining all models..."
python retrain_all_models.py

# 3. Monitor results
echo "3. Checking results..."
python monitor_models.py --health

# 4. Test predictions
echo "4. Testing predictions..."
curl http://localhost:5001/ml/forecast -X POST -H "Content-Type: application/json" -d '{"days": 7}'

echo "=== Retraining Complete ==="
```

---

## FAQ

**Q: How often should I retrain models?**
A: Start with weekly, adjust based on data volume and performance. Recommendations can be daily, forecast/inventory weekly.

**Q: What if auto-promotion promotes a worse model?**
A: This shouldn't happen (comparisons prevent it), but if it does, immediately rollback and investigate the comparison logic.

**Q: Can I retrain just one model?**
A: Yes! Edit `retraining_config.json` and disable the models you don't want to retrain.

**Q: How much disk space do versions use?**
A: Each version: ~10-50 MB. With 5 versions per model: ~150-750 MB total. Cleanup runs automatically.

**Q: What happens if retraining fails during scheduled run?**
A: Current production models remain active. Check logs for errors. Models won't be updated until successful retrain.

**Q: Can I rollback during active prediction serving?**
A: Yes! Flask will continue serving with current models. Restart Flask to load rolled-back versions.

**Q: How do I know if drift is serious?**
A: >10% degradation requires immediate attention. 5-10% should be monitored. <5% is normal variance.

---

## Summary

The automated retraining pipeline provides enterprise-grade model lifecycle management:

✅ **Automated** - Set and forget with scheduling
✅ **Safe** - Performance comparison before promotion
✅ **Recoverable** - Quick rollback if issues arise
✅ **Monitored** - Drift detection and alerting
✅ **Versioned** - Complete model history
✅ **Configurable** - Flexible thresholds and schedules

**Next Steps:**
1. Test manual retraining
2. Set up monitoring checks
3. Configure schedule
4. Enable automated retraining
5. Monitor and adjust

---

**Last Updated:** April 25, 2026
**Version:** 1.0.0
