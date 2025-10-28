pipeline {
  agent any
  options { timestamps(); buildDiscarder(logRotator(numToKeepStr: '15')) }
  parameters {
    string(name: 'DOCKER_NS', defaultValue: 'dinithan', description: 'Docker Hub namespace')
    string(name: 'APP_HOST', defaultValue: 'CHANGE_ME_APP_PUBLIC_IP', description: 'App VM public IP/DNS')
    string(name: 'RDS_ENDPOINT', defaultValue: '', description: 'Optional RDS endpoint')
    string(name: 'API_PORT', defaultValue: '8000')
    string(name: 'WEB_PORT', defaultValue: '8080')
  }
  environment {
    API_IMAGE = "${params.DOCKER_NS}/paylanka-api"
    WEB_IMAGE = "${params.DOCKER_NS}/paylanka-web"
    VERSION = ""
  }
  stages {
    stage('Checkout') {
      steps {
        checkout scm
        script {
          def gitShort = sh(returnStdout: true, script: "git rev-parse --short HEAD").trim()
          env.VERSION = "${env.BUILD_NUMBER}-${gitShort}"
          echo "Version = ${env.VERSION}"
        }
      }
    }
    stage('Docker Build') {
      steps {
        sh """
          docker build -t ${API_IMAGE}:${VERSION} -t ${API_IMAGE}:latest services/payments-api
          docker build -t ${WEB_IMAGE}:${VERSION} -t ${WEB_IMAGE}:latest web
        """
      }
    }
    stage('Docker Push') {
      steps {
        withCredentials([usernamePassword(credentialsId: 'dockerhub', usernameVariable: 'DH_USER', passwordVariable: 'DH_PASS')]) {
          sh """
            echo "$DH_PASS" | docker login -u "$DH_USER" --password-stdin
            docker push ${API_IMAGE}:${VERSION}
            docker push ${API_IMAGE}:latest
            docker push ${WEB_IMAGE}:${VERSION}
            docker push ${WEB_IMAGE}:latest
            docker logout || true
          """
        }
      }
    }
    stage('Deploy to App VM') {
      steps {
        script {
          if (!params.APP_HOST?.trim()) { error "APP_HOST parameter is empty." }
          def remoteScript = """
            set -euo pipefail
            which docker >/dev/null 2>&1 || { sudo apt-get update -y && sudo apt-get install -y docker.io docker-compose-plugin; sudo systemctl enable --now docker; }
            sudo mkdir -p /opt/paylanka && sudo chown ubuntu:ubuntu /opt/paylanka
            cd /opt/paylanka
            cat > .env <<'EOF'
API_IMAGE=${API_IMAGE}
WEB_IMAGE=${WEB_IMAGE}
API_TAG=${VERSION}
WEB_TAG=${VERSION}
API_PORT=${params.API_PORT}
WEB_PORT=${params.WEB_PORT}
DB_USER=postgres
DB_PASSWORD=postgres
DB_NAME=paylanka
DB_PORT=5432
EOF
            cat > docker-compose.prod.yml <<'YAML'
services:
  api:
    image: "${API_IMAGE}:${VERSION}"
    env_file: .env
    ports:
      - "${params.API_PORT}:${params.API_PORT}"
    restart: unless-stopped
  web:
    image: "${WEB_IMAGE}:${VERSION}"
    env_file: .env
    ports:
      - "${params.WEB_PORT}:80"
    restart: unless-stopped
  db:
    image: postgres:16
    environment:
      - POSTGRES_PASSWORD=postgres
      - POSTGRES_DB=paylanka
    volumes:
      - dbdata:/var/lib/postgresql/data
volumes:
  dbdata:
YAML
            docker compose -f docker-compose.prod.yml pull
            docker compose -f docker-compose.prod.yml up -d
            docker ps --format 'table {{.Names}}\t{{.Image}}\t{{.Status}}\t{{.Ports}}'
            curl -fsS http://localhost:${params.API_PORT}/health || true
          """
          sshagent (credentials: ['appvm-ssh']) {
            sh """
              ssh -o StrictHostKeyChecking=no ubuntu@${params.APP_HOST} 'bash -s' <<'REMOTE'
              ${remoteScript}
REMOTE
            """
          }
        }
      }
    }
    stage('Smoke Test') {
      steps {
        sh """
          curl -fsS http://${params.APP_HOST}:${params.WEB_PORT}/health || true
          curl -fsS http://${params.APP_HOST}:${params.API_PORT}/health || true
        """
      }
    }
  }
  post {
    success { echo "Open: http://${params.APP_HOST}:${params.WEB_PORT}" }
    failure { echo "Check console for stage failure." }
  }
}
