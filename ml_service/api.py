"""
FastAPI ML Service
Provides REST endpoints for ML model training and prediction
"""

from fastapi import FastAPI, HTTPException, BackgroundTasks, File, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import Dict, List, Any, Optional
from enum import Enum
import pandas as pd
import json
import logging
from datetime import datetime

from model_training import ModelTrainer
from prediction_service import PredictionService
from preprocessing import DataPreprocessor

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# FastAPI app
app = FastAPI(
    title="ML Prediction Service",
    description="Machine Learning service for lead scoring and customer lifetime value prediction",
    version="1.0.0"
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize services
model_trainer = ModelTrainer()
prediction_service = PredictionService()
preprocessor = DataPreprocessor()

# Pydantic models
class ModelType(str, Enum):
    LEAD_CONVERSION = "lead_conversion"
    CUSTOMER_LIFETIME_VALUE = "customer_lifetime_value"

class Algorithm(str, Enum):
    RANDOM_FOREST = "random_forest"
    GRADIENT_BOOSTING = "gradient_boosting"
    LOGISTIC_REGRESSION = "logistic_regression"
    LINEAR_REGRESSION = "linear_regression"
    NEURAL_NETWORK = "neural_network"

class TrainingRequest(BaseModel):
    model_type: ModelType
    algorithm: Algorithm
    model_name: str = Field(..., description="Name for the trained model")
    user_id: str = Field(..., description="User ID for model ownership")
    training_config: Optional[Dict[str, Any]] = Field(default_factory=dict)

class PredictionRequest(BaseModel):
    model_type: ModelType
    user_id: str
    model_name: Optional[str] = None
    data: Dict[str, Any] = Field(..., description="Data for prediction")

class BatchPredictionRequest(BaseModel):
    model_type: ModelType
    user_id: str
    model_name: Optional[str] = None
    data: List[Dict[str, Any]] = Field(..., description="List of data for batch prediction")

class TrainingResponse(BaseModel):
    success: bool
    model_path: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None
    metrics: Optional[Dict[str, Any]] = None
    error: Optional[str] = None

class PredictionResponse(BaseModel):
    success: bool
    prediction_type: Optional[str] = None
    conversion_probability: Optional[float] = None
    lifetime_value: Optional[float] = None
    confidence: Optional[float] = None
    prediction_class: Optional[str] = None
    value_category: Optional[str] = None
    feature_importance: Optional[Dict[str, Any]] = None
    model_info: Optional[Dict[str, Any]] = None
    error: Optional[str] = None

class BatchPredictionResponse(BaseModel):
    success: bool
    total_predictions: Optional[int] = None
    predictions: Optional[List[Dict[str, Any]]] = None
    model_info: Optional[Dict[str, Any]] = None
    error: Optional[str] = None

class ModelListResponse(BaseModel):
    models: List[Dict[str, Any]]

class HealthResponse(BaseModel):
    status: str
    timestamp: str
    version: str
    services: Dict[str, str]

# API Endpoints

@app.get("/health", response_model=HealthResponse)
async def health_check():
    """Health check endpoint"""
    return HealthResponse(
        status="healthy",
        timestamp=datetime.now().isoformat(),
        version="1.0.0",
        services={
            "model_trainer": "available",
            "prediction_service": "available",
            "preprocessor": "available"
        }
    )

@app.post("/train", response_model=TrainingResponse)
async def train_model(request: TrainingRequest, background_tasks: BackgroundTasks):
    """
    Train a new ML model

    This endpoint starts model training in the background and returns immediately.
    Check the model status using the models endpoint.
    """
    try:
        # For now, we'll implement synchronous training
        # In production, this would be moved to background tasks

        # Get training data from database (simplified)
        # In a real implementation, this would query the database
        training_data = _get_training_data(request.model_type, request.user_id)

        if training_data.empty:
            raise HTTPException(
                status_code=400,
                detail=f"No training data available for {request.model_type}"
            )

        # Prepare features and target
        X, y = _prepare_training_data(training_data, request.model_type)

        # Train model
        result = model_trainer.train_model(
            model_type=request.model_type.value,
            algorithm=request.algorithm.value,
            X=X,
            y=y,
            model_name=request.model_name,
            user_id=request.user_id,
            **request.training_config
        )

        if not result['success']:
            raise HTTPException(
                status_code=500,
                detail=result.get('error', 'Training failed')
            )

        return TrainingResponse(
            success=True,
            model_path=result['model_path'],
            metadata=result['metadata'],
            metrics=result['metrics']
        )

    except Exception as e:
        logger.error(f"Training error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/predict", response_model=PredictionResponse)
async def predict(request: PredictionRequest):
    """Make a single prediction"""
    try:
        if request.model_type == ModelType.LEAD_CONVERSION:
            result = prediction_service.predict_lead_conversion(
                request.data,
                request.user_id,
                request.model_name
            )
        elif request.model_type == ModelType.CUSTOMER_LIFETIME_VALUE:
            result = prediction_service.predict_customer_lifetime_value(
                request.data,
                request.user_id,
                request.model_name
            )
        else:
            raise HTTPException(status_code=400, detail="Invalid model type")

        if not result['success']:
            raise HTTPException(status_code=500, detail=result['error'])

        return PredictionResponse(**result)

    except Exception as e:
        logger.error(f"Prediction error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/predict/batch", response_model=BatchPredictionResponse)
async def batch_predict(request: BatchPredictionRequest):
    """Make batch predictions"""
    try:
        if request.model_type == ModelType.LEAD_CONVERSION:
            result = prediction_service.batch_predict_lead_conversion(
                request.data,
                request.user_id,
                request.model_name
            )
        else:
            raise HTTPException(status_code=400, detail="Batch prediction only supported for lead conversion")

        if not result['success']:
            raise HTTPException(status_code=500, detail=result['error'])

        return BatchPredictionResponse(**result)

    except Exception as e:
        logger.error(f"Batch prediction error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/models/{user_id}", response_model=ModelListResponse)
async def list_models(user_id: str):
    """List all trained models for a user"""
    try:
        models = model_trainer.get_model_list(user_id)
        return ModelListResponse(models=models)
    except Exception as e:
        logger.error(f"Error listing models: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/models/{user_id}/{model_name}")
async def delete_model(user_id: str, model_name: str):
    """Delete a trained model"""
    try:
        models = model_trainer.get_model_list(user_id)
        model_to_delete = None

        for model in models:
            if model['metadata']['model_name'] == model_name:
                model_to_delete = model
                break

        if not model_to_delete:
            raise HTTPException(status_code=404, detail="Model not found")

        success = model_trainer.delete_model(model_to_delete['model_path'])

        if not success:
            raise HTTPException(status_code=500, detail="Failed to delete model")

        return {"success": True, "message": f"Model {model_name} deleted successfully"}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting model: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/insights/{user_id}/{model_type}")
async def get_prediction_insights(user_id: str, model_type: str):
    """Get insights about prediction patterns and model performance"""
    try:
        insights = prediction_service.get_prediction_insights(user_id, model_type)
        return insights
    except Exception as e:
        logger.error(f"Error getting insights: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/preprocess")
async def preprocess_data(data: Dict[str, Any], config: Optional[Dict[str, Any]] = None):
    """Preprocess data for training or prediction"""
    try:
        df = pd.DataFrame(data if isinstance(data, list) else [data])

        # Apply preprocessing
        processed_df = preprocessor.preprocess_lead_data(df, config or {})

        # Validate data quality
        quality_report = preprocessor.validate_data_quality(processed_df)

        return {
            "success": True,
            "processed_data": processed_df.to_dict('records'),
            "quality_report": quality_report,
            "original_shape": df.shape,
            "processed_shape": processed_df.shape
        }

    except Exception as e:
        logger.error(f"Preprocessing error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# Helper functions

def _get_training_data(model_type: ModelType, user_id: str) -> pd.DataFrame:
    """Get training data from database (simplified implementation)"""
    # In a real implementation, this would query the database
    # For now, return sample data structure

    if model_type == ModelType.LEAD_CONVERSION:
        # Sample lead data for training
        sample_data = [
            {
                'email': 'user1@company.com',
                'job_title': 'CEO',
                'company': 'Tech Corp Inc',
                'lead_score': 85,
                'engagement_score': 90,
                'email_interactions': 5,
                'website_visits': 12,
                'content_downloads': 3,
                'created_at': '2024-01-01T00:00:00Z',
                'status': 'customer'  # Target variable
            },
            {
                'email': 'user2@gmail.com',
                'job_title': 'Manager',
                'company': 'Small Business LLC',
                'lead_score': 45,
                'engagement_score': 30,
                'email_interactions': 1,
                'website_visits': 2,
                'content_downloads': 0,
                'created_at': '2024-01-02T00:00:00Z',
                'status': 'new'  # Target variable
            }
        ]
    else:
        # Sample customer data for LTV prediction
        sample_data = [
            {
                'customer_id': 'cust1',
                'total_orders': 5,
                'total_spent': 2500.00,
                'avg_order_value': 500.00,
                'first_purchase_date': '2024-01-01T00:00:00Z',
                'lifetime_value': 2500.00  # Target variable
            }
        ]

    return pd.DataFrame(sample_data)

def _prepare_training_data(df: pd.DataFrame, model_type: ModelType) -> tuple:
    """Prepare training data by separating features and target"""
    if model_type == ModelType.LEAD_CONVERSION:
        # For lead conversion, target is the status (converted to binary)
        target_col = 'status'
        feature_cols = [col for col in df.columns if col != target_col]

        # Convert status to binary (1 for customer, 0 for others)
        y = (df[target_col] == 'customer').astype(int)
        X = df[feature_cols]

    else:
        # For LTV prediction, target is lifetime_value
        target_col = 'lifetime_value'
        feature_cols = [col for col in df.columns if col != target_col]

        y = df[target_col]
        X = df[feature_cols]

    return X, y

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)