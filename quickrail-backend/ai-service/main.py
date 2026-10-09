
import os
import joblib
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from sentence_transformers import SentenceTransformer

app = FastAPI(title="QuickRail AI")

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MODEL_PATH = os.path.join(
    BASE_DIR, "models", "quickrail_classifier.joblib"
)

classifier = None
embedding_model = None


class Message(BaseModel):
    text: str


@app.on_event("startup")
def load_models():
    global classifier, embedding_model

    if not os.path.exists(MODEL_PATH):
        raise RuntimeError("Classifier file is missing")

    classifier = joblib.load(MODEL_PATH)
    embedding_model = SentenceTransformer("all-MiniLM-L6-v2")


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/predict")
def predict(message: Message):
    if classifier is None or embedding_model is None:
        raise HTTPException(status_code=503, detail="AI is loading")

    vector = embedding_model.encode([message.text])
    prediction = classifier.predict(vector)[0]
    probabilities = classifier.predict_proba(vector)[0]

    return {
        "intent": str(prediction),
        "confidence": float(max(probabilities))
    }
