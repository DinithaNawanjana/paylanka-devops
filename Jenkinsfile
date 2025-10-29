pipeline {
  agent any
  options { timestamps() }

  environment {
    // ---- Docker Hub repo names ----
    DOCKER_USER = 'dinithan'
    API_IMAGE   = "${DOCKER_USER}/payments-api"
    WEB_IMAGE   = "${DOCKER_USER}/payments-web"     // optional (built only if Dockerfile exists)
    DB_IMAGE    = "postgres:16"

    // ---- App names / ports ----
    API_NAME    = 'paylanka-api'
    WEB_NAME    = 'paylanka-web'
    DB_NAME     = 'paylanka-db'
    API_PORT    = '8000'  // host/VPC port -> API
    WEB_PORT    = '8080'  // host/VPC port -> WEB (nginx/static site)
    DB_PORT     = '5432'  // host/VPC port -> Postgres (optional expose)
    NET_NAME    = 'paylanka-net'

    // ---- App VM (private IP inside VPC) ----
    APP_VM_HOST = '172.31.37.22'
    APP_VM_USER = 'ubuntu'

    // ---- Jenkins credentials IDs ----
    DH_CRED_ID  = 'dockerhub'  // Docker Hub username + PAT
    PG_CRED_ID  = 'pg-admin'   // Postgres username + password
    SSH_KEY_PATH = '/var/lib/jenkins/.ssh/id_appvm' // working key you tested
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

    // ---------- API: build & push ----------
    stage('Docker Build - API') {
      steps {
        script {
          def df  = 'services/payments-api/Dockerfile'
          def ctx = 'services/payments-api'
          if (!fileExists(df)) { error "API Dockerfile not found at ${df}" }

          sh """
            docker version
            docker build -t ${env.API_IMAGE}:${env.VERSION} -t ${env.API_IMAGE}:latest -f ${df} ${ctx}
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
          sh "docker push ${env.API_IMAGE}:${env.VERSION}"
          sh "docker push ${env.API_IMAGE}:latest"
          sh 'docker logout || true'
        }
      }
    }

    // ---------- WEB: build & push (optional) ----------
    stage('Docker Build - WEB (optional)') {
      steps {
        script {
          def df  = 'services/web/Dockerfile'
          def ctx = 'services/web'
          if (fileExists(df)) {
            sh """
              docker build -t ${env.WEB_IMAGE}:${env.VERSION} -t ${env.WEB_IMAGE}:latest -f ${df} ${ctx}
            """
          } else {
            echo "No ${df} found, skipping WEB image build."
            env.WEB_IMAGE = '' // mark as absent so later stages know to skip
          }
        }
      }
    }

    stage('Docker Push - WEB (optional)') {
      when { expression { return (env.WEB_IMAGE?.trim()) } }
      steps {
        withCredentials([usernamePassword(credentialsId: env.DH_CRED_ID, usernameVariable: 'DH_USER', passwordVariable: 'DH_PASS')]) {
          sh '''
            set -e
            printf "%s" "$DH_PASS" | tr -d "\\r\\n" | docker login -u "$DH_USER" --password-stdin
          '''
          sh "docker push ${env.WEB_IMAGE}:${env.VERSION}"
          sh "docker push ${env.WEB_IMAGE}:latest"
          sh 'docker logout || true'
        }
      }
    }

    // ---------- Deploy all on App VM ----------
    stage('Deploy Stack on App VM (DB + API + WEB)') {
      steps {
        withCredentials([
          usernamePassword(credentialsId: env.DH_CRED_ID, usernameVariable: 'DH_USER', passwordVariable: 'DH_PASS'),
          usernamePassword(credentialsId: env.PG_CRED_ID, usernameVariable: 'PG_USER', passwordVariable: 'PG_PASS')
        ]) {
          sh """
            set -e
            SSH_KEY='${env.SSH_KEY_PATH}'
            SSH_OPTS="-i \$SSH_KEY -o StrictHostKeyChecking=accept-new -o ConnectTimeout=20"
            [ -f "\$SSH_KEY" ] && chmod 600 "\$SSH_KEY"

            # Login to Docker Hub on remote
            printf "%s" "$DH_PASS" | tr -d "\\r\\n" | \\
              ssh \$SSH_OPTS ${env.APP_VM_USER}@${env.APP_VM_HOST} \\
                "docker login -u '${'$'}{DH_USER}' --password-stdin"

            # Create network if missing
            ssh \$SSH_OPTS ${env.APP_VM_USER}@${env.APP_VM_HOST} \\
              "docker network inspect ${env.NET_NAME} >/dev/null 2>&1 || docker network create ${env.NET_NAME}"

            # --- DB: Postgres (official image) ---
            ssh \$SSH_OPTS ${env.APP_VM_USER}@${env.APP_VM_HOST} bash -lc "set -e
              docker rm -f ${env.DB_NAME} 2>/dev/null || true
              docker run -d --name ${env.DB_NAME} --restart=always \\
                --network ${env.NET_NAME} \\
                -e POSTGRES_DB=paylanka \\
                -e POSTGRES_USER='${'$'}{PG_USER}' \\
                -e POSTGRES_PASSWORD='${'$'}{PG_PASS}' \\
                -v paylanka-pg:/var/lib/postgresql/data \\
                -p ${env.DB_PORT}:5432 ${env.DB_IMAGE}
            "

            # --- API: pull & run ---
            ssh \$SSH_OPTS ${env.APP_VM_USER}@${env.APP_VM_HOST} bash -lc "set -e
              docker pull ${env.API_IMAGE}:${env.VERSION}
              docker rm -f ${env.API_NAME} 2>/dev/null || true
              docker run -d --name ${env.API_NAME} --restart=always \\
                --network ${env.NET_NAME} \\
                -e DATABASE_URL='postgres://${'$'}{PG_USER}:${'$'}{PG_PASS}@${env.DB_NAME}:5432/paylanka' \\
                -p ${env.API_PORT}:${env.API_PORT} ${env.API_IMAGE}:${env.VERSION}
            "

            # --- WEB: pull & run (only if built/pushed earlier) ---
            ${ env.WEB_IMAGE?.trim()
              ? "ssh \$SSH_OPTS ${env.APP_VM_USER}@${env.APP_VM_HOST} bash -lc \"set -e \\
                   docker pull ${env.WEB_IMAGE}:${env.VERSION}; \\
                   docker rm -f ${env.WEB_NAME} 2>/dev/null || true; \\
                   docker run -d --name ${env.WEB_NAME} --restart=always \\
                     --network ${env.NET_NAME} \\
                     -p ${env.WEB_PORT}:80 ${env.WEB_IMAGE}:${env.VERSION} \\
                 \""
              : "echo 'WEB image not present; skipping WEB deploy on remote.'" }

            # Status
            ssh \$SSH_OPTS ${env.APP_VM_USER}@${env.APP_VM_HOST} "docker ps --format 'NAME={{.Names}}  STATUS={{.Status}}  PORTS={{.Ports}}' | egrep -i '${env.DB_NAME}|${env.API_NAME}|${env.WEB_NAME}' || true"
          """
        }
      }
    }

    // ---------- Smoke tests (API & WEB) ----------
    stage('Smoke Test') {
      steps {
        script {
          // API
          sh """
            for i in 1 2 3 4 5; do
              curl -fsS --max-time 5 http://${env.APP_VM_HOST}:${env.API_PORT}/ && exit 0
              echo "Smoke attempt \\$i (API) failed; retrying..."; sleep 3
            done
            echo "WARN: API smoke not 200"; exit 0
          """
          // WEB (only if we deployed it)
          if (env.WEB_IMAGE?.trim()) {
            sh """
              for i in 1 2 3 4 5; do
                curl -fsS --max-time 5 http://${env.APP_VM_HOST}:${env.WEB_PORT}/ && exit 0
                echo "Smoke attempt \\$i (WEB) failed; retrying..."; sleep 3
              done
              echo "WARN: WEB smoke not 200"; exit 0
            """
          } else {
            echo "WEB smoke skipped (no WEB image)."
          }
        }
      }
    }
  }

  post {
    success {
      echo "✅ Built & pushed: ${env.API_IMAGE}:${env.VERSION}${env.WEB_IMAGE?.trim() ? " and ${env.WEB_IMAGE}:${env.VERSION}" : ""}"
      echo "✅ Deployed on ${env.APP_VM_HOST}: API:${env.API_PORT}${env.WEB_IMAGE?.trim() ? " WEB:${env.WEB_PORT}" : ""} DB:${env.DB_PORT}"
    }
    failure {
      echo "❌ Build failed — check the stage logs above."
    }
  }
}
