#!/bin/bash

# =============================================================================
# NGROK URL MONITOR - Script para gerenciamento dinâmico de URLs Ngrok
# =============================================================================
# Descrição: Monitora continuamente as URLs do Ngrok e atualiza automaticamente
#              os arquivos de configuração do frontend e backend.
# Autor: Senior DevOps Automation Specialist
# Versão: 1.0.0
# =============================================================================

# =============================================================================
# CONFIGURAÇÕES USUÁRIO (Personalize estas variáveis conforme seu projeto)
# =============================================================================

# URL da API do Ngrok (geralmente não precisa mudar)
NGROK_API_URL="http://127.0.0.1:4040/api/tunnels"

# Intervalo de verificação em segundos
POLLING_INTERVAL=5

# Diretórios do projeto (ajuste conforme sua estrutura)
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKEND_DIR="$PROJECT_ROOT/packages/backend"
FRONTEND_DIR="$PROJECT_ROOT/packages/frontend"

# Arquivos de configuração
BACKEND_ENV_FILE="$BACKEND_DIR/.env"
FRONTEND_ENV_FILE="$FRONTEND_DIR/.env.local"

# Variáveis de ambiente a serem atualizadas
BACKEND_TUNNEL_VAR="PUBLIC_TUNNEL_URL"
FRONTEND_API_VAR="VITE_API_URL"

# Sufixo para API endpoints (geralmente /api)
API_ENDPOINT_SUFFIX="/api"

# Arquivo de configuração do Vite
VITE_CONFIG_FILE="$FRONTEND_DIR/vite.config.ts"

# Arquivo para armazenar a última URL conhecida
LAST_URL_FILE="$PROJECT_ROOT/.last_ngrok_url"

# Arquivo de log
LOG_FILE="$PROJECT_ROOT/ngrok-monitor.log"

# =============================================================================
# FUNÇÕES DE LOG
# =============================================================================

# Função para timestamp
get_timestamp() {
    date '+%Y-%m-%d %H:%M:%S'
}

# Função de log informativo
log_info() {
    local message="$1"
    echo "[$(get_timestamp)] INFO: $message" | tee -a "$LOG_FILE"
}

# Função de log de erro
log_error() {
    local message="$1"
    echo "[$(get_timestamp)] ERROR: $message" | tee -a "$LOG_FILE" >&2
}

# Função de log de sucesso
log_success() {
    local message="$1"
    echo "[$(get_timestamp)] SUCCESS: $message" | tee -a "$LOG_FILE"
}

# =============================================================================
# FUNÇÕES UTILITÁRIAS
# =============================================================================

# Verifica se o comando existe
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Verifica se o Ngrok está rodando
check_ngrok_running() {
    if command_exists curl; then
        curl -s --connect-timeout 3 "$NGROK_API_URL" >/dev/null 2>&1
    else
        return 1
    fi
}

# Obtém a URL pública atual do Ngrok
get_ngrok_url() {
    if ! command_exists curl; then
        log_error "curl não está instalado. Não é possível consultar a API do Ngrok."
        return 1
    fi

    local response
    response=$(curl -s "$NGROK_API_URL" 2>/dev/null)
    
    if [ $? -ne 0 ] || [ -z "$response" ]; then
        log_error "Não foi possível conectar à API do Ngrok em $NGROK_API_URL"
        return 1
    fi

    # Extrai a URL HTTPS usando jq ou grep/sed
    if command_exists jq; then
        echo "$response" | jq -r '.tunnels[] | select(.proto=="https") | .public_url' | head -n1
    else
        # Fallback sem jq
        echo "$response" | grep -o '"public_url":"https://[^"]*' | sed 's/"public_url":"https:\/\///' | head -n1
    fi
}

# Obtém a última URL conhecida
get_last_url() {
    if [ -f "$LAST_URL_FILE" ]; then
        cat "$LAST_URL_FILE"
    else
        echo ""
    fi
}

# Salva a URL atual
save_current_url() {
    local url="$1"
    echo "$url" > "$LAST_URL_FILE"
}

# =============================================================================
# FUNÇÕES DE ATUALIZAÇÃO DE CONFIGURAÇÃO
# =============================================================================

# Cria diretório se não existir
ensure_directory_exists() {
    local dir="$1"
    if [ ! -d "$dir" ]; then
        mkdir -p "$dir"
        log_info "Diretório criado: $dir"
    fi
}

# Atualiza variável em arquivo .env
update_env_var() {
    local file="$1"
    local var_name="$2"
    local var_value="$3"
    
    # Garante que o diretório existe
    ensure_directory_exists "$(dirname "$file")"
    
    # Se o arquivo não existe, cria com a variável
    if [ ! -f "$file" ]; then
        echo "$var_name=$var_value" > "$file"
        log_info "Arquivo $file criado com $var_name=$var_value"
        return 0
    fi
    
    # Verifica se a variável já existe no arquivo
    if grep -q "^$var_name=" "$file"; then
        # Atualiza variável existente
        if [[ "$OSTYPE" == "darwin"* ]]; then
            # macOS
            sed -i '' "s|^$var_name=.*|$var_name=$var_value|" "$file"
        else
            # Linux
            sed -i "s|^$var_name=.*|$var_name=$var_value|" "$file"
        fi
        log_info "Variável $var_name atualizada em $file"
    else
        # Adiciona nova variável
        echo "$var_name=$var_value" >> "$file"
        log_info "Variável $var_name adicionada em $file"
    fi
}

# Atualiza configuração do backend
update_backend_config() {
    local tunnel_url="$1"
    log_info "Atualizando configuração do backend..."
    
    update_env_var "$BACKEND_ENV_FILE" "$BACKEND_TUNNEL_VAR" "$tunnel_url"
    
    if [ $? -eq 0 ]; then
        log_success "Configuração do backend atualizada com sucesso"
    else
        log_error "Falha ao atualizar configuração do backend"
        return 1
    fi
}

# Atualiza configuração do Vite
update_vite_config() {
    local tunnel_url="$1"
    log_info "Atualizando configuração do Vite..."
    
    # Extrai o domínio da URL
    local domain=$(echo "$tunnel_url" | sed 's|https://||')
    
    # Verifica se o arquivo existe
    if [ ! -f "$VITE_CONFIG_FILE" ]; then
        log_error "Arquivo vite.config.ts não encontrado: $VITE_CONFIG_FILE"
        return 1
    fi
    
    # Verifica se o domínio já está nos allowedHosts
    if grep -q "'$domain'" "$VITE_CONFIG_FILE"; then
        log_info "Domínio $domain já está nos allowedHosts"
        log_success "Configuração do Vite já está correta"
        return 0
    fi
    
    # Atualiza allowedHosts no vite.config.ts
    if [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS
        sed -i '' "s/allowedHosts: \[.*\]/allowedHosts: ['localhost', '*.ngrok-free.app', '$domain']/" "$VITE_CONFIG_FILE"
    else
        # Linux
        sed -i "s/allowedHosts: \[.*\]/allowedHosts: ['localhost', '*.ngrok-free.app', '$domain']/" "$VITE_CONFIG_FILE"
    fi
    
    log_success "Configuração do Vite atualizada com sucesso: $domain"
}

# Atualiza configuração do frontend
update_frontend_config() {
    local tunnel_url="$1"
    local api_url="${tunnel_url}${API_ENDPOINT_SUFFIX}"
    log_info "Atualizando configuração do frontend..."
    
    update_env_var "$FRONTEND_ENV_FILE" "$FRONTEND_API_VAR" "$api_url"
    
    if [ $? -eq 0 ]; then
        log_success "Configuração do frontend atualizada com sucesso: $api_url"
    else
        log_error "Falha ao atualizar configuração do frontend"
        return 1
    fi
}

# =============================================================================
# FUNÇÃO PRINCIPAL
# =============================================================================

# Função principal de monitoramento
monitor_ngrok() {
    log_info "Iniciando monitoramento do Ngrok..."
    log_info "URL da API: $NGROK_API_URL"
    log_info "Intervalo de verificação: ${POLLING_INTERVAL}s"
    log_info "Diretório do projeto: $PROJECT_ROOT"
    
    # Loop infinito
    while true; do
        # Verifica se o Ngrok está rodando
        if ! check_ngrok_running; then
            log_error "Ngrok não está rodando ou não foi possível conectar à API"
            sleep "$POLLING_INTERVAL"
            continue
        fi
        
        # Obtém a URL atual
        current_url=$(get_ngrok_url)
        
        if [ $? -ne 0 ] || [ -z "$current_url" ]; then
            log_error "Não foi possível obter a URL do Ngrok"
            sleep "$POLLING_INTERVAL"
            continue
        fi
        
        # Obtém a última URL conhecida
        last_url=$(get_last_url)
        
        # Compara as URLs
        if [ "$current_url" != "$last_url" ]; then
            log_info "URL do Ngrok alterada!"
            log_info "URL anterior: ${last_url:-'(nenhuma)'}"
            log_info "URL atual: $current_url"
            
            # Atualiza as configurações
            if update_backend_config "$current_url" && update_frontend_config "$current_url" && update_vite_config "$current_url"; then
                # Salva a nova URL
                save_current_url "$current_url"
                log_success "Configurações atualizadas com sucesso!"
            else
                log_error "Falha ao atualizar configurações"
            fi
        else
            log_info "URL do Ngrok inalterada: $current_url"
        fi
        
        # Aguarda o próximo ciclo
        sleep "$POLLING_INTERVAL"
    done
}

# =============================================================================
# TRATAMENTO DE SINAIS E LIMPEZA
# =============================================================================

# Função de saída
cleanup() {
    log_info "Encerrando monitoramento do Ngrok..."
    exit 0
}

# Configura tratamento de sinais
trap cleanup SIGINT SIGTERM

# =============================================================================
# VERIFICAÇÃO DE PRÉ-REQUISITOS
# =============================================================================

# Verifica se curl está instalado
if ! command_exists curl; then
    log_error "curl não está instalado. Por favor, instale curl para continuar."
    log_error "Ubuntu/Debian: sudo apt-get install curl"
    log_error "CentOS/RHEL: sudo yum install curl"
    log_error "macOS: brew install curl"
    exit 1
fi

# Verifica se os diretórios do projeto existem
if [ ! -d "$BACKEND_DIR" ]; then
    log_error "Diretório do backend não encontrado: $BACKEND_DIR"
    exit 1
fi

if [ ! -d "$FRONTEND_DIR" ]; then
    log_error "Diretório do frontend não encontrado: $FRONTEND_DIR"
    exit 1
fi

# =============================================================================
# INÍCIO DA EXECUÇÃO
# =============================================================================

log_info "=========================================="
log_info "NGROK URL MONITOR INICIADO"
log_info "=========================================="

# Inicia o monitoramento
monitor_ngrok