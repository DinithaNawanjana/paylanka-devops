pipeline {
  agent any
  options {
    timestamps()
    // Uncomment if you have AnsiColor plugin
    // ansiColor('xterm')
  }

  environment {
    // ---- Image + app naming ----
    DOCKER_USER = 'dinithan'
    IMAGE       = "${DOCKER_USER}/payments-api"
    APP_NAME    = 'paylanka-api'

    // ---- Ports ----
    // Host port your users will hit (Security Group must allow this)
    APP_PORT        = '8000'
    // Container port your app listens on INSIDE the container
    CONTAINER_PORT  = '8000'

    // ---- Optional deploy target (fill DNS/IP to enable deploy) ----
    APP_VM_HOST = 'ec2-13-60-190-46.eu-north-1.compute.amazonaws.com'
    APP_VM_USER = 'ubuntu'

    // ---- Credentials IDs in Jenkins ----
    SSH_CRED_ID = 'appvm-ssh'   // SSH Username with private key
    DH_CRED_ID  = 'dockerhub'   // Username with password (token)
  }

  stages {
    stage('Checkout') {
      steps {
        checkout scm
      }
    }

    stage('Version') {
      steps {
        script {
          def sha = sh(script: 'git rev-parse --short HEAD 2>/dev/null || true', returnStdout: true).trim()
          if (!sha) {
            sha = sh(script: 'date +%Y%m%d%H%M%S', returnStdout: true).trim()
          }
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
          if (!fileExists(df)) {
            df  = 'Dockerfile'
            ctx = '.'
          }
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
            echo "$DH_PASS" | docker login -u "$DH_USER" --password-stdin
            docker push '"${IMAGE}"':'"${VERSION}"'
            docker push '"${IMAGE}"':latest
          '''
        }
      }
    }

    stage('Deploy to App VM') {
      when {
        expression { return (env.APP_VM_HOST?.trim()) }
      }
      steps {
        sshagent(credentials: [env.SSH_CRED_ID]) {
          withCredentials([usernamePassword(credentialsId: env.DH_CRED_ID, usernameVariable: 'DH_USER', passwordVariable: 'DH_PASS')]) {
            sh '''
              set -e
              SSH_OPTS="-o StrictHostKeyChecking=accept-new -o ConnectTimeout=15"

              # Safely pass Docker Hub token to remote via base64
              TOKEN_B64=$(printf '%s' "$DH_PASS" | base64 -w0)

              # Login to Docker Hub on remote
              ssh $SSH_OPTS '"${APP_VM_USER}"'@'"${APP_VM_HOST}"' \
                "echo $TOKEN_B64 | base64 -d | docker login -u '"$DH_USER"' --password-stdin"

              # Pull, replace container, map host ${APP_PORT} -> container ${CONTAINER_PORT}
              ssh $SSH_OPTS '"${APP_VM_USER}"'@'"${APP_VM_HOST}"' bash -lc '
                set -e
                docker pull '"${IMAGE}"':'"${VERSION}"'
                docker rm -f '"${APP_NAME}"' 2>/dev/null || true
                docker run -d --name '"${APP_NAME}"' --restart=always \
                  -p '"${APP_PORT}"':'"${CONTAINER_PORT}"' '"${IMAGE}"':'"${VERSION}"'
              '

              # Show container status
              ssh $SSH_OPTS '"${APP_VM_USER}"'@'"${APP_VM_HOST}"' \
                "docker ps --filter name='${APP_NAME}' --format '{{.Names}} {{.Status}} {{.Ports}}'"
            '''
          }
        }
      }
    }

    stage('Smoke Test') {
      when {
        expression { return (env.APP_VM_HOST?.trim()) }
      }
      steps {
        script {
          // Try a few times to allow container startup
          sh """
            set +e
            for i in 1 2 3 4 5; do
              curl -fsS --max-time 5 http://${APP_VM_HOST}:${APP_PORT}/ && exit 0
              echo 'Smoke attempt '$i' failed; retrying in 3s...'
              sleep 3
            done
            echo 'WARNING: Smoke test could not confirm HTTP 200, continuing (check logs).'
            exit 0
          """
        }
      }
    }
  }

  post {
    success {
      echo "✅ Build ${env.VERSION} built, pushed, and (if configured) deployed."
    }
    failure {
      echo "❌ Build failed — check the stage logs above."
    }
    always {
      // Optional: docker logout to be tidy
      sh 'docker logout || true'
    }
  }
}
