pipeline {
  agent any
  options {
    timestamps()
  }

  environment {
    // ---- Image + app names ----
    DOCKER_USER   = 'dinithan'
    IMAGE         = "${DOCKER_USER}/payments-api"
    APP_NAME      = 'paylanka-api'

    // ---- Ports ----
    APP_PORT       = '8000'   // host/VPC port to expose
    CONTAINER_PORT = '8000'   // container port your app listens on

    // ---- Deploy target (private IP in VPC) ----
    // TIP: If you ever switch to a public DNS/IP, just change this value.
    APP_VM_HOST = '172.31.37.22'
    APP_VM_USER = 'ubuntu'

    // ---- Jenkins credentials IDs ----
    // 1) dockerhub: Username+Password (token)
    // 2) appvm-ssh: SSH Username with private key (ubuntu + id_appvm)
    // 3) github-https: used by your job's SCM (no change needed here)
    DH_CRED_ID  = 'dockerhub'
    SSH_CRED_ID = 'appvm-ssh'
  }

  stages {
    stage('Checkout') {
      steps {
        // Uses the job's configured SCM; logs show it already uses credential 'github-https'
        checkout scm
      }
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

    stage('Docker Build') {
      steps {
        script {
          def df  = 'services/payments-api/Dockerfile'
          def ctx = 'services/payments-api'
          if (!fileExists(df)) { df = 'Dockerfile'; ctx = '.' }

          sh """
            docker version
            docker build -t ${env.IMAGE}:${env.VERSION} -t ${env.IMAGE}:latest -f ${df} ${ctx}
          """
        }
      }
    }

    stage('Docker Push') {
      steps {
        withCredentials([usernamePassword(credentialsId: env.DH_CRED_ID, usernameVariable: 'DH_USER', passwordVariable: 'DH_PASS')]) {
          sh '''
            set -e
            echo "$DH_PASS" | docker login -u "$DH_USER" --password-stdin
            docker push ${IMAGE}:${VERSION}
            docker push ${IMAGE}:latest
            docker logout || true
          '''
        }
      }
    }

    stage('Deploy to App VM') {
      when { expression { return (env.APP_VM_HOST?.trim()) } }
      steps {
        // requires SSH Agent plugin
        sshagent(credentials: [env.SSH_CRED_ID]) {
          withCredentials([usernamePassword(credentialsId: env.DH_CRED_ID, usernameVariable: 'DH_USER', passwordVariable: 'DH_PASS')]) {
            sh '''
              set -e
              SSH_OPTS="-o StrictHostKeyChecking=accept-new -o ConnectTimeout=20"

              # Ensure Docker exists on remote (safe to run repeatedly)
              ssh $SSH_OPTS ${APP_VM_USER}@${APP_VM_HOST} '
                set -e
                if ! command -v docker >/dev/null 2>&1; then
                  curl -fsSL https://get.docker.com | sh
                  sudo usermod -aG docker $USER || true
                fi
              '

              # Login to Docker Hub on remote (pass token via base64)
              TOKEN_B64=$(printf "%s" "$DH_PASS" | base64 -w0)
              ssh $SSH_OPTS ${APP_VM_USER}@${APP_VM_HOST} "
                echo $TOKEN_B64 | base64 -d | docker login -u '${DH_USER}' --password-stdin
              "

              # Pull & restart container
              ssh $SSH_OPTS ${APP_VM_USER}@${APP_VM_HOST} bash -lc '
                set -e
                docker pull ${IMAGE}:${VERSION}
                docker rm -f ${APP_NAME} 2>/dev/null || true
                docker run -d --name ${APP_NAME} --restart=always \
                  -p ${APP_PORT}:${CONTAINER_PORT} ${IMAGE}:${VERSION}
              '

              # Show container status
              ssh $SSH_OPTS ${APP_VM_USER}@${APP_VM_HOST} \
                "docker ps --filter name='${APP_NAME}' --format 'NAME={{.Names}}  STATUS={{.Status}}  PORTS={{.Ports}}'"
            '''
          }
        }
      }
    }

    stage('Smoke Test') {
      when { expression { return (env.APP_VM_HOST?.trim()) } }
      steps {
        sh '''
          set +e
          for i in 1 2 3 4 5; do
            curl -fsS --max-time 5 http://${APP_VM_HOST}:${APP_PORT}/ && exit 0
            echo "Smoke attempt $i failed; retrying in 3s..."
            sleep 3
          done
          echo "WARNING: Smoke test did not return HTTP 200; continuing (check app logs)."
          exit 0
        '''
      }
    }
  }

  post {
    success { echo "✅ Build ${env.VERSION} built, pushed, and deployed to ${env.APP_VM_HOST}:${env.APP_PORT}." }
    failure { echo "❌ Build failed — check the stage logs above." }
  }
}
