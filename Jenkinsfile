pipeline {
  agent any
  options { timestamps() }

  environment {
    // ---- Image + app names ----
    DOCKER_USER   = 'dinithan'
    IMAGE         = "${DOCKER_USER}/payments-api"
    APP_NAME      = 'paylanka-api'

    // ---- Ports ----
    APP_PORT       = '8000'   // host/VPC port to expose
    CONTAINER_PORT = '8000'   // container port your app listens on

    // ---- Deploy target (private IP in VPC) ----
    APP_VM_HOST = '172.31.37.22'    // change to public DNS/IP if exposing to internet
    APP_VM_USER = 'ubuntu'

    // ---- Jenkins credentials IDs ----
    DH_CRED_ID   = 'dockerhub'  // Username + PAT (password field)
    SSH_CRED_ID  = 'appvm-ssh'  // SSH Username with private key (username=ubuntu)
  }

  stages {
    stage('Checkout') {
      steps {
        checkout scm  // job already uses 'github-https' per logs
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
          // Login (no Groovy interpolation of the secret)
          sh '''
            set -e
            printf "%s" "$DH_PASS" | tr -d "\\r\\n" | docker login -u "$DH_USER" --password-stdin
          '''
          // Push (expand IMAGE/VERSION in Groovy first)
          sh "docker push ${env.IMAGE}:${env.VERSION}"
          sh "docker push ${env.IMAGE}:latest"
          sh 'docker logout || true'
        }
      }
    }

    stage('Deploy to App VM') {
      when { expression { return (env.APP_VM_HOST?.trim()) } }
      steps {
        sshagent(credentials: [env.SSH_CRED_ID]) {
          withCredentials([usernamePassword(credentialsId: env.DH_CRED_ID, usernameVariable: 'DH_USER', passwordVariable: 'DH_PASS')]) {
            sh """
              set -e
              SSH_OPTS="-o StrictHostKeyChecking=accept-new -o ConnectTimeout=20"

              # Login to Docker Hub on remote (token via stdin)
              printf "%s" "$DH_PASS" | tr -d "\\r\\n" | \
                ssh \$SSH_OPTS ${env.APP_VM_USER}@${env.APP_VM_HOST} \
                  "docker login -u '${'$'}{DH_USER}' --password-stdin"

              # Pull & restart container (use double quotes so vars expand here)
              ssh \$SSH_OPTS ${env.APP_VM_USER}@${env.APP_VM_HOST} bash -lc "set -e
                docker pull ${env.IMAGE}:${env.VERSION}
                docker rm -f ${env.APP_NAME} 2>/dev/null || true
                docker run -d --name ${env.APP_NAME} --restart=always \\
                  -p ${env.APP_PORT}:${env.CONTAINER_PORT} ${env.IMAGE}:${env.VERSION}
              "

              # Show status
              ssh \$SSH_OPTS ${env.APP_VM_USER}@${env.APP_VM_HOST} \\
                "docker ps --filter name='${env.APP_NAME}' --format 'NAME={{.Names}}  STATUS={{.Status}}  PORTS={{.Ports}}'"
            """
          }
        }
      }
    }

    stage('Smoke Test') {
      when { expression { return (env.APP_VM_HOST?.trim()) } }
      steps {
        // Try 5 times for slow starts; don't fail the build
        sh "for i in 1 2 3 4 5; do curl -fsS --max-time 5 http://${env.APP_VM_HOST}:${env.APP_PORT}/ && exit 0; echo 'Smoke attempt '$i' failed; sleep 3'; sleep 3; done; echo 'WARN: smoke not 200'; exit 0"
      }
    }
  }

  post {
    success { echo "✅ Build ${env.VERSION} built, pushed, and deployed to ${env.APP_VM_HOST}:${env.APP_PORT}." }
    failure { echo "❌ Build failed — check the stage logs above." }
  }
}
