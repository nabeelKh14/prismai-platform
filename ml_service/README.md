# ML Prediction Service

A comprehensive machine learning service for lead scoring and customer lifetime value prediction, built with FastAPI and scikit-learn.

## Features

- **Lead Conversion Prediction**: Predict the probability of a lead converting to a customer
- **Customer Lifetime Value Prediction**: Estimate the lifetime value of customers
- **Multiple ML Algorithms**: Support for Random Forest, Gradient Boosting, Logistic Regression, Linear Regression, and Neural Networks
- **Data Preprocessing**: Comprehensive data cleaning, feature engineering, and validation
- **Model Management**: Version control, persistence, and performance tracking
- **RESTful API**: Clean API endpoints for training and prediction
- **Batch Processing**: Support for batch predictions
- **Model Monitoring**: Track model performance and data quality

## Quick Start

### 1. Installation

```bash
# Navigate to the ML service directory
cd ml_service

# Create virtual environment
python -m venv venv

# Activate virtual environment (Windows)
venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt
```

### 2. Configuration

Set environment variables:

```bash
export MODEL_DIR=models
export ML_SERVICE_URL=http://localhost:8001
```

### 3. Start the Service

```bash
# Development mode
python start_service.py --reload

# Production mode
python start_service.py --host 0.0.0.0 --port 8001 --workers 4
```

The service will be available at `http://localhost:8001`

## API Endpoints

### Health Check
```http
GET /health
```

### Train Model
```http
POST /train
Content-Type: application/json

{
  "model_type": "lead_conversion",
  "algorithm": "random_forest",
  "model_name": "my_lead_model",
  "user_id": "user123",
  "training_config": {
    "features": ["lead_score", "engagement_score", "company_size"],
    "preprocessing": {
      "missing_value_strategy": "mean",
      "categorical_encoding": "one_hot"
    }
  }
}
```

### Make Prediction
```http
POST /predict
Content-Type: application/json

{
  "model_type": "lead_conversion",
  "user_id": "user123",
  "data": {
    "email": "user@company.com",
    "job_title": "CEO",
    "company": "Tech Corp",
    "lead_score": 85,
    "engagement_score": 90
  }
}
```

### Batch Prediction
```http
POST /predict/batch
Content-Type: application/json

{
  "model_type": "lead_conversion",
  "user_id": "user123",
  "data": [
    {
      "email": "user1@company.com",
      "job_title": "CEO",
      "company": "Tech Corp",
      "lead_score": 85
    },
    {
      "email": "user2@company.com",
      "job_title": "Manager",
      "company": "Small Business",
      "lead_score": 45
    }
  ]
}
```

### List Models
```http
GET /models/{user_id}
```

### Get Model Insights
```http
GET /insights/{user_id}/{model_type}
```

### Preprocess Data
```http
POST /preprocess
Content-Type: application/json

{
  "data": [
    {
      "email": "user@company.com",
      "job_title": "CEO",
      "company": "Tech Corp"
    }
  ],
  "config": {
    "missing_value_strategy": "mean",
    "categorical_encoding": "one_hot"
  }
}
```

## Supported Model Types

### Lead Conversion
- **Algorithms**: Random Forest, Gradient Boosting, Logistic Regression, Neural Network
- **Target**: Binary classification (will convert to customer or not)
- **Features**: Lead score, engagement score, company size, job title, email domain, etc.

### Customer Lifetime Value
- **Algorithms**: Random Forest, Gradient Boosting, Linear Regression, Neural Network
- **Target**: Regression (predicted lifetime value)
- **Features**: Purchase history, order frequency, average order value, customer tenure, etc.

## Data Preprocessing

The service includes comprehensive data preprocessing:

- **Missing Value Handling**: Mean, median, most frequent, or constant fill
- **Categorical Encoding**: One-hot encoding or label encoding
- **Feature Scaling**: Standard scaling or min-max scaling
- **Feature Selection**: K-best features or mutual information
- **Feature Engineering**: Time-based features, interaction features, log transformations

## Model Training

### Training Process
1. Data validation and quality assessment
2. Feature preprocessing and engineering
3. Train/validation/test split
4. Hyperparameter optimization (GridSearchCV)
5. Cross-validation evaluation
6. Model persistence and versioning

### Supported Algorithms

#### Classification (Lead Conversion)
- **Random Forest**: Ensemble method with high accuracy
- **Gradient Boosting**: Sequential model improvement
- **Logistic Regression**: Linear model for binary classification
- **Neural Network**: Deep learning approach

#### Regression (Lifetime Value)
- **Random Forest**: Ensemble method for regression
- **Gradient Boosting**: Sequential model improvement
- **Linear Regression**: Linear relationship modeling
- **Neural Network**: Deep learning for complex patterns

## Model Evaluation

The service provides comprehensive model evaluation:

- **Classification Metrics**: Accuracy, Precision, Recall, F1-Score, ROC-AUC
- **Regression Metrics**: MSE, MAE, R², RMSE
- **Cross-Validation**: K-fold validation scores
- **Feature Importance**: Understanding key predictors

## Integration with Next.js Application

The ML service integrates seamlessly with the existing Next.js application:

1. **API Routes**: `/api/ml/predict` provides ML predictions
2. **Database Integration**: Stores predictions and model metadata
3. **Fallback System**: Falls back to rule-based scoring if ML fails
4. **Real-time Updates**: Updates lead scores with ML predictions

### Usage in Next.js

```typescript
// Train a new model
const trainModel = async () => {
  const response = await fetch('/api/ml/predict', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      modelType: 'lead_conversion',
      algorithm: 'random_forest',
      modelName: 'my_model'
    })
  })
  return response.json()
}

// Make a prediction
const predictLead = async (leadData: any) => {
  const response = await fetch('/api/ml/predict', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      modelType: 'lead_conversion',
      leadData: leadData
    })
  })
  return response.json()
}
```

## Monitoring and Maintenance

### Model Performance Tracking
- Automatic performance metric collection
- Prediction confidence scoring
- Feature importance analysis
- Model drift detection

### Data Quality Monitoring
- Input data validation
- Missing value tracking
- Outlier detection
- Data drift monitoring

### Retraining Triggers
- Performance degradation detection
- Data volume thresholds
- Time-based retraining
- Manual retraining requests

## Development

### Project Structure
```
ml_service/
├── api.py                 # FastAPI application
├── model_training.py      # ML model training logic
├── prediction_service.py  # Prediction service
├── preprocessing.py       # Data preprocessing
├── start_service.py       # Service startup script
├── requirements.txt       # Python dependencies
└── README.md             # This file
```

### Adding New Algorithms
1. Update `model_training.py` with new algorithm configuration
2. Add algorithm-specific parameters and hyperparameters
3. Update API models in `api.py`
4. Test with sample data

### Custom Preprocessing
1. Extend `DataPreprocessor` class in `preprocessing.py`
2. Add new preprocessing steps
3. Update configuration schemas
4. Test preprocessing pipeline

## Troubleshooting

### Common Issues

1. **Model Training Fails**
   - Check data quality and volume
   - Verify feature types and ranges
   - Review preprocessing configuration

2. **Predictions Are Inaccurate**
   - Retrain with more data
   - Try different algorithms
   - Review feature engineering

3. **Service Won't Start**
   - Check Python version (3.8+)
   - Verify dependencies installation
   - Check port availability

### Logging
The service provides detailed logging:
- Training progress and metrics
- Prediction requests and results
- Error messages and warnings
- Performance statistics

## Production Deployment

### Docker Deployment
```dockerfile
FROM python:3.11-slim

WORKDIR /app
COPY requirements.txt .
RUN pip install -r requirements.txt

COPY . .
EXPOSE 8001

CMD ["python", "start_service.py", "--host", "0.0.0.0", "--port", "8001"]
```

### Environment Variables
```bash
MODEL_DIR=/app/models
LOG_LEVEL=INFO
WORKERS=4
HOST=0.0.0.0
PORT=8001
```

### Health Checks
```bash
curl http://localhost:8001/health
```

## Contributing

1. Follow the existing code structure
2. Add comprehensive tests
3. Update documentation
4. Test with various datasets
5. Ensure backward compatibility

## License

This project is part of the PrismAI platform and follows the same licensing terms.