#!/bin/bash

# =============================================================================
# SETUP NGROK MONITOR - Script de instalação e configuração
# =============================================================================
# Descrição: Configura o ambiente para o Ngrok URL Monitor
# Autor: Senior DevOps Automation Specialist
# Versão: 1.0.0
# =============================================================================

set -e  # Exit on error

# =============================================================================
# CONFIGURAÇÕES
# =============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
MONITOR_SCRIPT="$SCRIPT_DIR/ngrok-url-monitor.sh"
SERVICE_FILE="$SCRIPT_DIR/ngrok-monitor.service"

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# =============================================================================
# FUNÇÕES
# =============================================================================

print_header() {
    echo -e "${BLUE}============================================${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}============================================${NC}"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

# Verifica se o comando existe
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Verifica se o usuário tem permissões de sudo
check_sudo() {
    if ! sudo -n true 2>/dev/null; then
        print_warning "Este script precisa de permissões de sudo para algumas operações"
        print_info "Você será solicitado a digitar sua senha"
    fi
}

# =============================================================================
# VERIFICAÇÃO DE PRÉ-REQUISITOS
# =============================================================================

check_prerequisites() {
    print_header "VERIFICANDO PRÉ-REQUISITOS"
    
    local missing_deps=()
    
    # Verifica curl
    if ! command_exists curl; then
        missing_deps+=("curl")
    fi
    
    # Verifica jq (opcional)
    if ! command_exists jq; then
        print_warning "jq não está instalado (opcional, recomendado para melhor parsing JSON)"
        print_info "Para instalar jq:"
        print_info "  Ubuntu/Debian: sudo apt-get install jq"
        print_info "  CentOS/RHEL: sudo yum install jq"
        print_info "  macOS: brew install jq"
    fi
    
    # Verifica se o script do monitor existe
    if [ ! -f "$MONITOR_SCRIPT" ]; then
        print_error "Script do monitor não encontrado: $MONITOR_SCRIPT"
        exit 1
    fi
    
    # Verifica dependências faltantes
    if [ ${#missing_deps[@]} -gt 0 ]; then
        print_error "Dependências faltantes: ${missing_deps[*]}"
        print_info "Por favor, instale as dependências e execute este script novamente"
        exit 1
    fi
    
    print_success "Todos os pré-requisitos verificados"
}

# =============================================================================
# CONFIGURAÇÃO DO SCRIPT
# =============================================================================

configure_monitor_script() {
    print_header "CONFIGURANDO SCRIPT DO MONITOR"
    
    # Torna o script executável
    chmod +x "$MONITOR_SCRIPT"
    print_success "Script do monitor tornado executável"
    
    # Verifica se o usuário quer personalizar as configurações
    echo
    read -p "Deseja personalizar as configurações do monitor? (s/N): " -n 1 -r
    echo
    
    if [[ $REPLY =~ ^[Ss]$ ]]; then
        print_info "Abrindo o script para edição..."
        print_info "Personalize as variáveis na seção 'CONFIGURAÇÕES USUÁRIO'"
        print_info "Pressione Ctrl+X para sair do editor (se usar nano)"
        
        # Tenta detectar o editor disponível
        if command_exists nano; then
            nano "$MONITOR_SCRIPT"
        elif command_exists vim; then
            vim "$MONITOR_SCRIPT"
        elif command_exists code; then
            code "$MONITOR_SCRIPT"
        else
            print_warning "Nenhum editor encontrado. Edite manualmente: $MONITOR_SCRIPT"
            read -p "Pressione Enter para continuar..."
        fi
    else
        print_info "Usando configurações padrão"
    fi
    
    print_success "Configuração do script concluída"
}

# =============================================================================
# CRIAÇÃO DE ESTRUTURA DE DIRETÓRIOS
# =============================================================================

create_directory_structure() {
    print_header "CRIANDO ESTRUTURA DE DIRETÓRIOS"
    
    # Diretórios do backend e frontend
    local backend_dir="$PROJECT_ROOT/packages/backend"
    local frontend_dir="$PROJECT_ROOT/packages/frontend"
    
    # Cria diretórios se não existirem
    for dir in "$backend_dir" "$frontend_dir"; do
        if [ ! -d "$dir" ]; then
            mkdir -p "$dir"
            print_success "Diretório criado: $dir"
        else
            print_success "Diretório já existe: $dir"
        fi
    done
    
    print_success "Estrutura de diretórios verificada"
}

# =============================================================================
# CONFIGURAÇÃO DE SERVIÇO SYSTEMD (Linux)
# =============================================================================

configure_systemd_service() {
    print_header "CONFIGURANDO SERVIÇO SYSTEMD"
    
    # Verifica se é Linux e tem systemd
    if [[ "$OSTYPE" != "linux-gnu"* ]] || ! command_exists systemctl; then
        print_warning "Sistema operacional não suporta systemd"
        print_info "Você precisará executar o script manualmente ou configurar outro método"
        return
    fi
    
    echo
    read -p "Deseja configurar o serviço systemd para execução automática? (s/N): " -n 1 -r
    echo
    
    if [[ ! $REPLY =~ ^[Ss]$ ]]; then
        print_info "Configuração do serviço systemd pulada"
        return
    fi
    
    check_sudo
    
    # Obtém o caminho absoluto do projeto
    local project_root_abs
    project_root_abs=$(realpath "$PROJECT_ROOT")
    
    # Obtém o usuário atual
    local current_user
    current_user=$(whoami)
    
    # Cria arquivo de serviço temporário
    local temp_service="/tmp/ngrok-monitor.service"
    
    cat > "$temp_service" << EOF
[Unit]
Description=Ngrok URL Monitor Service
Documentation=$SCRIPT_DIR/README-NGROK-MONITOR.md
After=network.target
Wants=network.target

[Service]
Type=simple
User=$current_user
Group=$current_user
WorkingDirectory=$project_root_abs
ExecStart=/bin/bash $MONITOR_SCRIPT
ExecReload=/bin/kill -HUP \$MAINPID
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal
SyslogIdentifier=ngrok-monitor

# Security settings
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=$project_root_abs

[Install]
WantedBy=multi-user.target
EOF
    
    # Instala o serviço
    print_info "Instalando serviço systemd..."
    
    if sudo cp "$temp_service" /etc/systemd/system/; then
        print_success "Arquivo de serviço copiado para /etc/systemd/system/"
    else
        print_error "Falha ao copiar arquivo de serviço"
        rm -f "$temp_service"
        return 1
    fi
    
    # Recarrega systemd
    if sudo systemctl daemon-reload; then
        print_success "Systemd recarregado"
    else
        print_error "Falha ao recarregar systemd"
        return 1
    fi
    
    # Habilita o serviço
    echo
    read -p "Deseja habilitar o serviço para iniciar automaticamente com o sistema? (s/N): " -n 1 -r
    echo
    
    if [[ $REPLY =~ ^[Ss]$ ]]; then
        if sudo systemctl enable ngrok-monitor; then
            print_success "Serviço habilitado para inicialização automática"
        else
            print_error "Falha ao habilitar serviço"
        fi
    fi
    
    # Limpa arquivo temporário
    rm -f "$temp_service"
    
    print_success "Configuração do serviço systemd concluída"
    print_info "Comandos úteis:"
    print_info "  Iniciar serviço: sudo systemctl start ngrok-monitor"
    print_info "  Parar serviço: sudo systemctl stop ngrok-monitor"
    print_info "  Verificar status: sudo systemctl status ngrok-monitor"
    print_info "  Verificar logs: sudo journalctl -u ngrok-monitor -f"
}

# =============================================================================
# CONFIGURAÇÃO DE ATALHOS E SCRIPTS
# =============================================================================

create_shortcuts() {
    print_header "CRIANDO ATALHOS E SCRIPTS"
    
    # Cria script de inicialização fácil
    local start_script="$PROJECT_ROOT/start-ngrok-monitor.sh"
    
    cat > "$start_script" << 'EOF'
#!/bin/bash

# Script de inicialização fácil para o Ngrok Monitor

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/scripts" && pwd)"

echo "Iniciando Ngrok URL Monitor..."
echo "Pressione Ctrl+C para parar"
echo "Logs serão salvos em: ngrok-monitor.log"
echo

exec "$SCRIPT_DIR/ngrok-url-monitor.sh"
EOF
    
    chmod +x "$start_script"
    print_success "Script de inicialização criado: start-ngrok-monitor.sh"
    
    # Adiciona ao package.json se existir
    local package_json="$PROJECT_ROOT/package.json"
    if [ -f "$package_json" ]; then
        print_info "Adicionando scripts ao package.json..."
        
        # Verifica se jq está disponível para manipulação JSON
        if command_exists jq; then
            # Backup do package.json
            cp "$package_json" "$package_json.backup"
            
            # Adiciona scripts se não existirem
            if ! jq -e '.scripts["ngrok:monitor"]' "$package_json" >/dev/null; then
                jq '.scripts += {
                    "ngrok:monitor": "./scripts/ngrok-url-monitor.sh",
                    "ngrok:setup": "./scripts/setup-ngrok-monitor.sh",
                    "ngrok:start": "./start-ngrok-monitor.sh"
                }' "$package_json" > "$package_json.tmp" && mv "$package_json.tmp" "$package_json"
                
                print_success "Scripts adicionados ao package.json"
            else
                print_info "Scripts já existem no package.json"
            fi
        else
            print_warning "jq não disponível para manipular package.json automaticamente"
            print_info "Adicione manualmente os seguintes scripts ao seu package.json:"
            print_info '  "ngrok:monitor": "./scripts/ngrok-url-monitor.sh",'
            print_info '  "ngrok:setup": "./scripts/setup-ngrok-monitor.sh",'
            print_info '  "ngrok:start": "./start-ngrok-monitor.sh"'
        fi
    fi
}

# =============================================================================
# TESTE DE CONFIGURAÇÃO
# =============================================================================

test_configuration() {
    print_header "TESTANDO CONFIGURAÇÃO"
    
    print_info "Verificando se o Ngrok está rodando..."
    
    # Verifica se o Ngrok está rodando
    if curl -s --connect-timeout 3 "http://127.0.0.1:4040/api/tunnels" >/dev/null 2>&1; then
        print_success "Ngrok detectado e acessível"
        
        # Tenta obter a URL atual
        local current_url
        current_url=$(curl -s "http://127.0.0.1:4040/api/tunnels" | grep -o '"public_url":"[^"]*https://[^"]*' | sed 's/.*"https:\/\/"/https:\/\//' | head -n1)
        
        if [ -n "$current_url" ]; then
            print_success "URL do Ngrok obtida: $current_url"
        else
            print_warning "Não foi possível obter a URL do Ngrok (pode não haver túneis ativos)"
        fi
    else
        print_warning "Ngrok não detectado ou não acessível"
        print_info "Inicie o Ngrok antes de usar o monitor:"
        print_info "  ngrok http 3001"
    fi
    
    # Verifica se o script do monitor pode ser executado
    if [ -x "$MONITOR_SCRIPT" ]; then
        print_success "Script do monitor é executável"
    else
        print_error "Script do monitor não é executável"
        return 1
    fi
    
    print_success "Teste de configuração concluído"
}

# =============================================================================
# RESUMO FINAL
# =============================================================================

show_summary() {
    print_header "RESUMO DA INSTALAÇÃO"
    
    echo -e "${GREEN}✅ Ngrok URL Monitor configurado com sucesso!${NC}"
    echo
    echo -e "${BLUE}Arquivos criados:${NC}"
    echo -e "  • Script principal: $MONITOR_SCRIPT"
    echo -e "  • Script de inicialização: $PROJECT_ROOT/start-ngrok-monitor.sh"
    echo -e "  • Documentação: $SCRIPT_DIR/README-NGROK-MONITOR.md"
    
    if [ -f "/etc/systemd/system/ngrok-monitor.service" ]; then
        echo -e "  • Serviço systemd: /etc/systemd/system/ngrok-monitor.service"
    fi
    
    echo
    echo -e "${BLUE}Como usar:${NC}"
    echo -e "  • Execução manual: ${YELLOW}./start-ngrok-monitor.sh${NC}"
    echo -e "  • Execução direta: ${YELLOW}./scripts/ngrok-url-monitor.sh${NC}"
    
    if [ -f "/etc/systemd/system/ngrok-monitor.service" ]; then
        echo -e "  • Iniciar serviço: ${YELLOW}sudo systemctl start ngrok-monitor${NC}"
        echo -e "  • Parar serviço: ${YELLOW}sudo systemctl stop ngrok-monitor${NC}"
        echo -e "  • Verificar status: ${YELLOW}sudo systemctl status ngrok-monitor${NC}"
    fi
    
    echo
    echo -e "${BLUE}Próximos passos:${NC}"
    echo -e "  1. Inicie o Ngrok: ${YELLOW}ngrok http 3001${NC}"
    echo -e "  2. Inicie o monitor: ${YELLOW}./start-ngrok-monitor.sh${NC}"
    echo -e "  3. Verifique os logs: ${YELLOW}tail -f ngrok-monitor.log${NC}"
    
    echo
    echo -e "${GREEN}Configuração concluída! 🎉${NC}"
}

# =============================================================================
# FUNÇÃO PRINCIPAL
# =============================================================================

main() {
    print_header "NGROK URL MONITOR - SETUP"
    
    echo -e "${BLUE}Bem-vindo ao assistente de configuração do Ngrok URL Monitor!${NC}"
    echo
    echo -e "${BLUE}Este script irá:${NC}"
    echo -e "  • Verificar pré-requisitos"
    echo -e "  • Configurar o script do monitor"
    echo -e "  • Criar estrutura de diretórios"
    echo -e "  • Configurar serviço systemd (opcional)"
    echo -e "  • Criar atalhos e scripts auxiliares"
    echo -e "  • Testar a configuração"
    echo
    
    read -p "Deseja continuar? (S/n): " -n 1 -r
    echo
    
    if [[ $REPLY =~ ^[Nn]$ ]]; then
        print_info "Instalação cancelada"
        exit 0
    fi
    
    # Executa as etapas de configuração
    check_prerequisites
    configure_monitor_script
    create_directory_structure
    configure_systemd_service
    create_shortcuts
    test_configuration
    show_summary
    
    echo
    print_success "Setup concluído com sucesso!"
}

# Executa a função principal
main "$@"