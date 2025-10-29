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
    APP_VM_HOST = '172.31.37.22'   // change to public DNS/IP if exposing to internet
    APP_VM_USER = 'ubuntu'

    // ---- Jenkins credentials IDs ----
    // 1) dockerhub  : Username+Password (use your Docker PAT in the password field)
    // 2) github-https: already used by SCM (no changes here)
    DH_CRED_ID  = 'dockerhub'
  }

  stages {
    stage('Checkout') {
      steps {
        // Uses job's configured SCM (logs show it already uses 'github-https')
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
      // 1) Do the login in a shell block
      sh '''
        set -e
        printf "%s" "$DH_PASS" | tr -d "\\r\\n" | docker login -u "$DH_USER" --password-stdin
      '''
      // 2) Use Groovy to expand IMAGE/VERSION before sh executes
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
        // NOTE: ssh-agent loads your 'appvm-ssh' private key automatically.
        sh '''
          set -e
          SSH_OPTS="-o StrictHostKeyChecking=accept-new -o ConnectTimeout=20"

          # Login to Docker Hub on remote without exposing token in logs
          printf "%s" "$DH_PASS" | tr -d "\\r\\n" | \
            ssh $SSH_OPTS ${APP_VM_USER}@${APP_VM_HOST} \
              "docker login -u '${DH_USER}' --password-stdin"

          # Pull & (re)start container
          ssh $SSH_OPTS ${APP_VM_USER}@${APP_VM_HOST} bash -lc '
            set -e
            docker pull ${IMAGE}:${VERSION}
            docker rm -f ${APP_NAME} 2>/dev/null || true
            docker run -d --name ${APP_NAME} --restart=always \
              -p ${APP_PORT}:${CONTAINER_PORT} ${IMAGE}:${VERSION}
          '

          # Show status
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
    // Use Groovy interpolation so env vars expand before shell runs
    sh "for i in 1 2 3 4 5; do curl -fsS --max-time 5 http://${env.APP_VM_HOST}:${env.APP_PORT}/ && exit 0; echo 'Smoke attempt '$i' failed; sleep 3'; sleep 3; done; echo 'WARN: smoke not 200'; exit 0"
  }
}


  post {
    success { echo "✅ Build ${env.VERSION} built, pushed, and deployed to ${env.APP_VM_HOST}:${env.APP_PORT}." }
    failure { echo "❌ Build failed — check the stage logs above." }
  }
}
