#!/bin/bash

# Investment Tracker Application Management Script
# Unified script for managing both development and production environments

set -e

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
SERVER_DIR="$PROJECT_ROOT/server"
CLIENT_DIR="$PROJECT_ROOT/client"
LOG_DIR="$PROJECT_ROOT/logs"
PID_DIR="$PROJECT_ROOT/pids"

# Default values
DEFAULT_COMPONENT="all"
DEFAULT_LOG_LINES=50
MODE="development"  # Default mode

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Create necessary directories
mkdir -p "$LOG_DIR" "$PID_DIR"

# Helper functions
log_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

log_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

log_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

log_error() {
    echo -e "${RED}❌ $1${NC}"
}

log_header() {
    echo -e "${PURPLE}🚀 $1${NC}"
}

# Check if process is running
is_running() {
    local component=$1
    local pid_file="$PID_DIR/${component}.pid"
    
    if [ -f "$pid_file" ]; then
        local pid=$(cat "$pid_file")
        if kill -0 "$pid" 2>/dev/null; then
            return 0
        else
            rm -f "$pid_file"
            return 1
        fi
    fi
    return 1
}

# Get process PID
get_pid() {
    local component=$1
    local pid_file="$PID_DIR/${component}.pid"
    
    if [ -f "$pid_file" ]; then
        cat "$pid_file"
    fi
}

# Detect environment mode
detect_mode() {
    if [ -f "$SERVER_DIR/dist/index.js" ] && [ -f "$CLIENT_DIR/dist/index.html" ]; then
        MODE="production"
    else
        MODE="development"
    fi
}

# Check dependencies
check_dependencies() {
    local component=$1
    
    case $component in
        "server")
            if [ ! -d "$SERVER_DIR/node_modules" ]; then
                log_error "Server dependencies not installed. Run 'npm run setup' first."
                exit 1
            fi
            ;;
        "client")
            if [ ! -d "$CLIENT_DIR/node_modules" ]; then
                log_error "Client dependencies not installed. Run 'npm run setup' first."
                exit 1
            fi
            ;;
        "all")
            check_dependencies "server"
            check_dependencies "client"
            ;;
    esac
}

# Start server
start_server() {
    if is_running "server"; then
        log_warning "Server is already running (PID: $(get_pid server))"
        return 0
    fi
    
    log_info "Starting server in $MODE mode..."
    
    cd "$SERVER_DIR"
    
    if [ "$MODE" = "production" ]; then
        # Check if production build exists
        if [ ! -f "dist/index.js" ]; then
            log_error "Production build not found. Run 'npm run build' first."
            exit 1
        fi
        
        # Check if database exists
        if [ ! -f "data/investment_tracker.db" ]; then
            log_error "Database not found. Run 'npm run db:migrate' first."
            exit 1
        fi
        
        nohup node dist/index.js > "$LOG_DIR/server.log" 2>&1 &
    else
        nohup npm run dev > "$LOG_DIR/server.log" 2>&1 &
    fi
    
    echo $! > "$PID_DIR/server.pid"
    log_success "Server started (PID: $!)"
    log_info "Server logs: $LOG_DIR/server.log"
}

# Start client
start_client() {
    if [ "$MODE" = "production" ]; then
        log_info "Client runs in production mode via server static files"
        return 0
    fi
    
    if is_running "client"; then
        log_warning "Client is already running (PID: $(get_pid client))"
        return 0
    fi
    
    log_info "Starting client in development mode..."
    
    cd "$CLIENT_DIR"
    nohup npm run dev > "$LOG_DIR/client.log" 2>&1 &
    echo $! > "$PID_DIR/client.pid"
    log_success "Client started (PID: $!)"
    log_info "Client logs: $LOG_DIR/client.log"
}

# Stop process
stop_process() {
    local component=$1
    local force=${2:-false}
    
    if ! is_running "$component"; then
        log_warning "$component is not running"
        return 0
    fi
    
    local pid=$(get_pid "$component")
    log_info "Stopping $component (PID: $pid)..."
    
    if [ "$force" = true ]; then
        kill -9 "$pid" 2>/dev/null || true
    else
        kill -TERM "$pid" 2>/dev/null || true
        
        # Wait for graceful shutdown
        local count=0
        while kill -0 "$pid" 2>/dev/null && [ $count -lt 10 ]; do
            sleep 1
            count=$((count + 1))
        done
        
        # Force kill if still running
        if kill -0 "$pid" 2>/dev/null; then
            log_warning "Graceful shutdown failed, force killing..."
            kill -9 "$pid" 2>/dev/null || true
        fi
    fi
    
    rm -f "$PID_DIR/${component}.pid"
    log_success "$component stopped"
}

# Show status
show_status() {
    local component=${1:-all}
    
    log_header "Application Status"
    echo "Mode: $MODE"
    echo "Project Root: $PROJECT_ROOT"
    echo ""
    
    case $component in
        "server"|"all")
            if is_running "server"; then
                echo -e "${GREEN}Server: Running${NC} (PID: $(get_pid server))"
                if [ "$MODE" = "production" ]; then
                    echo "  URL: http://localhost:3002"
                    echo "  API: http://localhost:3002/api"
                else
                    echo "  URL: http://localhost:3002"
                    echo "  API: http://localhost:3002/api"
                fi
            else
                echo -e "${RED}Server: Stopped${NC}"
            fi
            ;;
    esac
    
    case $component in
        "client"|"all")
            if [ "$MODE" = "production" ]; then
                echo -e "${BLUE}Client: Production (served by server)${NC}"
            else
                if is_running "client"; then
                    echo -e "${GREEN}Client: Running${NC} (PID: $(get_pid client))"
                    echo "  URL: http://localhost:5173"
                else
                    echo -e "${RED}Client: Stopped${NC}"
                fi
            fi
            ;;
    esac
    
    echo ""
    echo "Health Check: http://localhost:3002/health"
}

# Show logs
show_logs() {
    local component=${1:-all}
    local lines=${2:-$DEFAULT_LOG_LINES}
    
    case $component in
        "server")
            if [ -f "$LOG_DIR/server.log" ]; then
                log_info "Server logs (last $lines lines):"
                tail -n "$lines" "$LOG_DIR/server.log"
            else
                log_warning "Server log file not found"
            fi
            ;;
        "client")
            if [ "$MODE" = "production" ]; then
                log_info "Client logs are included in server logs in production mode"
                show_logs "server" "$lines"
            else
                if [ -f "$LOG_DIR/client.log" ]; then
                    log_info "Client logs (last $lines lines):"
                    tail -n "$lines" "$LOG_DIR/client.log"
                else
                    log_warning "Client log file not found"
                fi
            fi
            ;;
        "all")
            show_logs "server" "$lines"
            if [ "$MODE" = "development" ]; then
                echo ""
                show_logs "client" "$lines"
            fi
            ;;
    esac
}

# Show help
show_help() {
    echo "Investment Tracker Application Management"
    echo ""
    echo "Usage: ./scripts/app.sh COMMAND [OPTIONS]"
    echo ""
    echo "Commands:"
    echo "  start [server|client|all]    Start application components [default: all]"
    echo "  stop [server|client|all]     Stop application components [default: all]"
    echo "  force-stop                   Force stop all processes (production emergency)"
    echo "  restart [server|client|all]  Restart application components [default: all]"
    echo "  status                       Show application status"
    echo "  logs [server|client|all] [lines]  Show logs [default: all, 50 lines]"
    echo "  help                         Show this help message"
    echo ""
    echo "Examples:"
    echo "  ./scripts/app.sh start                     # Start both server and client"
    echo "  ./scripts/app.sh start server              # Start only server"
    echo "  ./scripts/app.sh stop                      # Stop both server and client"
    echo "  ./scripts/app.sh restart client            # Restart only client"
    echo "  ./scripts/app.sh status                    # Show status of both components"
    echo "  ./scripts/app.sh logs server 100           # Show last 100 lines of server log"
    echo ""
    echo "Environment Detection:"
    echo "  - Development: Uses npm run dev for live reloading"
    echo "  - Production: Uses built files (requires npm run build first)"
    echo ""
    echo "URLs:"
    echo "  - Development: Client at http://localhost:5173, Server at http://localhost:3002"
    echo "  - Production: Application at http://localhost:3002"
    echo "  - API: http://localhost:3002/api"
    echo "  - Health: http://localhost:3002/health"
}

# Main command handling
main() {
    # Detect environment mode
    detect_mode
    
    local command=${1:-help}
    local component=${2:-$DEFAULT_COMPONENT}
    local option3=${3:-}
    
    case $command in
        "start")
            log_header "Starting Investment Tracker ($MODE mode)"
            check_dependencies "$component"
            
            case $component in
                "server")
                    start_server
                    ;;
                "client")
                    start_client
                    ;;
                "all")
                    start_server
                    if [ "$MODE" = "development" ]; then
                        sleep 2  # Give server time to start
                        start_client
                    fi
                    ;;
                *)
                    log_error "Invalid component: $component"
                    show_help
                    exit 1
                    ;;
            esac
            
            echo ""
            show_status "$component"
            ;;
            
        "stop")
            log_header "Stopping Investment Tracker"
            
            case $component in
                "server")
                    stop_process "server"
                    ;;
                "client")
                    stop_process "client"
                    ;;
                "all")
                    stop_process "client"
                    stop_process "server"
                    ;;
                *)
                    log_error "Invalid component: $component"
                    show_help
                    exit 1
                    ;;
            esac
            ;;
            
        "force-stop")
            log_header "Force stopping all processes"
            stop_process "client" true
            stop_process "server" true
            ;;
            
        "restart")
            log_header "Restarting Investment Tracker"
            
            case $component in
                "server")
                    stop_process "server"
                    sleep 2
                    check_dependencies "server"
                    start_server
                    ;;
                "client")
                    stop_process "client"
                    sleep 2
                    check_dependencies "client"
                    start_client
                    ;;
                "all")
                    stop_process "client"
                    stop_process "server"
                    sleep 2
                    check_dependencies "all"
                    start_server
                    if [ "$MODE" = "development" ]; then
                        sleep 2
                        start_client
                    fi
                    ;;
                *)
                    log_error "Invalid component: $component"
                    show_help
                    exit 1
                    ;;
            esac
            
            echo ""
            show_status "$component"
            ;;
            
        "status")
            show_status "$component"
            ;;
            
        "logs")
            local lines=${option3:-$DEFAULT_LOG_LINES}
            show_logs "$component" "$lines"
            ;;
            
        "help"|"--help"|"-h")
            show_help
            ;;
            
        *)
            log_error "Unknown command: $command"
            echo ""
            show_help
            exit 1
            ;;
    esac
}

# Run main function with all arguments
main "$@"