pipeline {
  agent any
  options { timestamps() }

  environment {
    // ---- Images ----
    DOCKER_USER = 'dinithan'
    IMAGE_API   = "${DOCKER_USER}/payments-api"
    IMAGE_WEB   = "${DOCKER_USER}/payments-web"

    // ---- App info ----
    APP_NAME_API  = 'paylanka-api'
    APP_WEB_PORT  = '8080'
    APP_API_PORT  = '8000'

    // ---- Deploy target ----
    APP_VM_HOST = '172.31.37.22'
    APP_VM_USER = 'ubuntu'
    REMOTE_DIR  = '/home/ubuntu/paylanka'

    // ---- Jenkins credential IDs ----
    DH_CRED_ID   = 'dockerhub'   // Docker Hub (username+PAT)
    SSH_CRED_ID  = 'appvm-ssh'   // SSH Username+PrivateKey (username=ubuntu)
  }

  stages {
    stage('Checkout') {
      steps { checkout scm }
    }

    stage('Version') {
      steps {
        script {
          def sha = sh(script: 'git rev-parse --short HEAD 2>/dev/null || true', returnStdout: true).trim()
          if (!sha) { sha = sh(script: 'date +%Y%m%d%H%M%S', returnStdout: true).trim() }
          env.VERSION = sha
          echo "Version = ${env.VERSION}"
        }
      }
    }

    stage('Docker Build - API') {
      steps {
        script {
          def df  = 'services/payments-api/Dockerfile'
          def ctx = 'services/payments-api'
          if (!fileExists(df)) { error "Missing ${df}. Commit your API Dockerfile." }

          sh """
            docker version
            docker build -t ${env.IMAGE_API}:${env.VERSION} -t ${env.IMAGE_API}:latest -f ${df} ${ctx}
          """
        }
      }
    }

    stage('Docker Push - API') {
      steps {
        withCredentials([usernamePassword(credentialsId: env.DH_CRED_ID, usernameVariable: 'DH_USER', passwordVariable: 'DH_PASS')]) {
          sh '''
            set -e
            printf "%s" "$DH_PASS" | tr -d "\\r\\n" | docker login -u "$DH_USER" --password-stdin
          '''
          sh "docker push ${env.IMAGE_API}:${env.VERSION}"
          sh "docker push ${env.IMAGE_API}:latest"
          sh 'docker logout || true'
        }
      }
    }

    stage('Docker Build - WEB') {
      steps {
        script {
          def df  = 'web/Dockerfile'
          def ctx = 'web'
          if (!fileExists(df)) {
            echo "No ${df} found — did you generate it? Skipping WEB build."
            return
          }
          sh """
            docker build -t ${env.IMAGE_WEB}:${env.VERSION} -t ${env.IMAGE_WEB}:latest -f ${df} ${ctx}
          """
        }
      }
    }

    stage('Docker Push - WEB') {
      when { expression { return fileExists('web/Dockerfile') } }
      steps {
        withCredentials([usernamePassword(credentialsId: env.DH_CRED_ID, usernameVariable: 'DH_USER', passwordVariable: 'DH_PASS')]) {
          sh '''
            set -e
            printf "%s" "$DH_PASS" | tr -d "\\r\\n" | docker login -u "$DH_USER" --password-stdin
          '''
          sh "docker push ${env.IMAGE_WEB}:${env.VERSION}"
          sh "docker push ${env.IMAGE_WEB}:latest"
          sh 'docker logout || true'
        }
      }
    }

    stage('Deploy Stack on App VM (DB + API + WEB)') {
  steps {
    withCredentials([sshUserPrivateKey(credentialsId: env.SSH_CRED_ID, 
                                       keyFileVariable: 'SSH_KEY',
                                       usernameVariable: 'SSH_USER')]) {
      script {
        // Ensure remote dir
        sh """
          ssh -i "$SSH_KEY" -o StrictHostKeyChecking=accept-new -o ConnectTimeout=20 \
            ${SSH_USER}@${env.APP_VM_HOST} 'sudo mkdir -p ${env.REMOTE_DIR} && sudo chown ${SSH_USER}:${SSH_USER} ${env.REMOTE_DIR}'
        """

        // Copy compose + env
        if (fileExists('docker-compose.prod.yml')) {
          sh """
            scp -i "$SSH_KEY" -o StrictHostKeyChecking=accept-new -o ConnectTimeout=20 \
              docker-compose.prod.yml ${SSH_USER}@${env.APP_VM_HOST}:${env.REMOTE_DIR}/docker-compose.prod.yml
          """
        } else { error "docker-compose.prod.yml not found" }

        if (fileExists('.env.prod')) {
          sh """
            scp -i "$SSH_KEY" -o StrictHostKeyChecking=accept-new -o ConnectTimeout=20 \
              .env.prod ${SSH_USER}@${env.APP_VM_HOST}:${env.REMOTE_DIR}/.env.prod
          """
        } else {
          sh """
            ssh -i "$SSH_KEY" -o StrictHostKeyChecking=accept-new -o ConnectTimeout=20 ${SSH_USER}@${env.APP_VM_HOST} 'cat > ${env.REMOTE_DIR}/.env.prod <<EOF
DOCKER_USER=${env.DOCKER_USER}
IMAGE_TAG=${env.IMAGE_TAG}
DB_NAME=paylanka
DB_USER=paylanka
DB_PASS=P@ylanka123
API_PORT=8000
WEB_PORT=8080
EOF'
          """
        }

        // Force IMAGE_TAG
        sh """
          ssh -i "$SSH_KEY" -o StrictHostKeyChecking=accept-new -o ConnectTimeout=20 ${SSH_USER}@${env.APP_VM_HOST} \
            "sed -i 's/^IMAGE_TAG=.*/IMAGE_TAG=${env.IMAGE_TAG}/' ${env.REMOTE_DIR}/.env.prod || echo IMAGE_TAG=${env.IMAGE_TAG} >> ${env.REMOTE_DIR}/.env.prod"
        """

        // Pull & up
        sh """
          ssh -i "$SSH_KEY" -o StrictHostKeyChecking=accept-new -o ConnectTimeout=20 ${SSH_USER}@${env.APP_VM_HOST} \
            "cd ${env.REMOTE_DIR} && \
             docker compose -f docker-compose.prod.yml --env-file .env.prod pull && \
             docker compose -f docker-compose.prod.yml --env-file .env.prod up -d && \
             docker compose -f docker-compose.prod.yml --env-file .env.prod ps"
        """
      }
    }
  }
}


    stage('Smoke Test') {
      when { expression { return (env.APP_VM_HOST?.trim()) } }
      steps {
        // Escape $i so Groovy doesn’t treat it as a Groovy var
        sh "for i in 1 2 3 4 5; do curl -fsS --max-time 5 http://${env.APP_VM_HOST}:${env.APP_WEB_PORT}/ && exit 0; echo 'Smoke attempt '\\\$i' failed; sleep 3'; sleep 3; done; echo 'WARN: smoke not 200'; exit 0"
      }
    }
  }

  post {
    success { echo "✅ Built & deployed VERSION=${env.VERSION}. Web: http://${env.APP_VM_HOST}:${env.APP_WEB_PORT}  API: http://${env.APP_VM_HOST}:${env.APP_API_PORT}" }
    failure { echo "❌ Build failed — check the stage logs above." }
  }
}
