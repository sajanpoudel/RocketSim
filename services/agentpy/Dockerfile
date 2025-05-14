FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY app.py .
ENV OPENAI_API_KEY=${OPENAI_API_KEY}
CMD ["python","app.py"] 