pipeline {
  agent any
  options {
    timestamps()
  }
  environment {
    DOCKER_USER = 'dinithan'
    IMAGE      = "${DOCKER_USER}/payments-api"
    APP_NAME   = 'paylanka-api'
    APP_PORT   = '8000'

    // Optional deploy target (set a valid host if you want deploy enabled)
    APP_VM_HOST = 'ec2-13-60-190-46.eu-north-1.compute.amazonaws.com'
    APP_VM_USER = 'ubuntu'
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
          // Try to get short SHA; fall back to timestamp if git not present
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
          // Find Dockerfile + context dynamically
          def df  = 'services/payments-api/Dockerfile'
          def ctx = 'services/payments-api'
          if (!fileExists(df)) {
            df = 'Dockerfile'
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
        withCredentials([usernamePassword(credentialsId: 'dockerhub', usernameVariable: 'DH_USER', passwordVariable: 'DH_PASS')]) {
          sh """
            echo "${DH_PASS}" | docker login -u "${DH_USER}" --password-stdin
            docker push ${env.IMAGE}:${env.VERSION}
            docker push ${env.IMAGE}:latest
          """
        }
      }
    }

    stage('Deploy to App VM') {
      when {
        allOf {
          expression { return env.APP_VM_HOST?.trim() }
        }
      }
      steps {
        // Requires Jenkins credential of type "SSH Username with private key" with ID 'appvm-ssh'
        sshagent(credentials: ['appvm-ssh']) {
          sh """
            ssh -o StrictHostKeyChecking=no ${env.APP_VM_USER}@${env.APP_VM_HOST} \
              "docker login -u ${env.DOCKER_USER} -p \$(echo '${env.IMAGE}' >/dev/null; echo '***USE_TOKEN_IN_JENKINS_CRED***') || true"
            ssh -o StrictHostKeyChecking=no ${env.APP_VM_USER}@${env.APP_VM_HOST} \
              "docker pull ${env.IMAGE}:${env.VERSION} &&
               docker rm -f ${env.APP_NAME} 2>/dev/null || true &&
               docker run -d --name ${env.APP_NAME} -p ${env.APP_PORT}:8000 ${env.IMAGE}:${env.VERSION}"
          """
        }
      }
    }

    stage('Smoke Test') {
      steps {
        script {
          // If deployed, try to ping the service; otherwise just log a note
          if (env.APP_VM_HOST?.trim()) {
            sh "curl -fsS http://${env.APP_VM_HOST}:${env.APP_PORT}/ || true"
          } else {
            echo "Skipping smoke test (no APP_VM_HOST set)."
          }
        }
      }
    }
  }

  post {
    failure {
      echo 'Check console for stage failure.'
    }
  }
}
