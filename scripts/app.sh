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
    
    # First check PID file if it exists
    if [ -f "$pid_file" ]; then
        local pid=$(cat "$pid_file")
        if kill -0 "$pid" 2>/dev/null; then
            return 0
        else
            rm -f "$pid_file"
        fi
    fi
    
    # Also check for processes running on port 3002 (for server)
    if [ "$component" = "server" ]; then
        if lsof -i :3002 >/dev/null 2>&1; then
            return 0
        fi
    fi
    
    return 1
}

# Get process PID
get_pid() {
    local component=$1
    local pid_file="$PID_DIR/${component}.pid"
    
    # First try PID file
    if [ -f "$pid_file" ]; then
        local pid=$(cat "$pid_file")
        if kill -0 "$pid" 2>/dev/null; then
            echo "$pid"
            return
        else
            rm -f "$pid_file"
        fi
    fi
    
    # For server, try to find process on port 3002
    if [ "$component" = "server" ]; then
        local port_pid=$(lsof -ti :3002 2>/dev/null | head -1)
        if [ -n "$port_pid" ]; then
            echo "$port_pid"
            return
        fi
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
    
    # In development mode, ensure client is built for single-port serving
    if [ "$MODE" = "development" ]; then
        if [ ! -f "$CLIENT_DIR/dist/index.html" ]; then
            log_info "Building client for development mode..."
            cd "$CLIENT_DIR"
            npm run build
            cd "$SERVER_DIR"
        fi
    fi
    
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
        
        nohup node --max-old-space-size=2048 dist/index.js > "$LOG_DIR/server.log" 2>&1 &
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
    
    log_info "In development mode, client is served through server on port 3002"
    log_info "For live reloading, the server runs with tsx watch"
    return 0
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
    if [ -z "$pid" ]; then
        log_warning "Could not find PID for $component"
        return 1
    fi
    
    log_info "Stopping $component (PID: $pid)..."
    
    # For server, also try to stop parent npm process if it exists
    if [ "$component" = "server" ]; then
        local parent_pid=$(ps -o ppid= -p "$pid" 2>/dev/null | tr -d ' ')
        if [ -n "$parent_pid" ] && [ "$parent_pid" != "1" ]; then
            local parent_cmd=$(ps -o command= -p "$parent_pid" 2>/dev/null)
            if echo "$parent_cmd" | grep -q "npm"; then
                log_info "Also stopping parent npm process (PID: $parent_pid)..."
                if [ "$force" = true ]; then
                    kill -9 "$parent_pid" 2>/dev/null || true
                else
                    kill -TERM "$parent_pid" 2>/dev/null || true
                fi
            fi
        fi
    fi
    
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
                echo -e "${BLUE}Client: Development (served by server on port 3002)${NC}"
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
            log_info "Client logs are included in server logs (single-port mode)"
            show_logs "server" "$lines"
            ;;
        "all")
            show_logs "server" "$lines"
            # In single-port mode, all logs are in server.log
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
    echo "  deploy                       Pull latest code, rebuild, and restart"
    echo "  status                       Show application status"
    echo "  logs [server|client|all] [lines]  Show logs [default: all, 50 lines]"
    echo "  help                         Show this help message"
    echo ""
    echo "Examples:"
    echo "  ./scripts/app.sh start                     # Start application (single port)"
    echo "  ./scripts/app.sh start server              # Start server"
    echo "  ./scripts/app.sh stop                      # Stop application"
    echo "  ./scripts/app.sh restart                   # Restart application"
    echo "  ./scripts/app.sh status                    # Show application status"
    echo "  ./scripts/app.sh logs server 100           # Show last 100 lines of server log"
    echo ""
    echo "Environment Detection:"
    echo "  - Development: Server hot reloading, client served from build"
    echo "  - Production: Uses built files (requires npm run build first)"
    echo ""
    echo "URLs:"
    echo "  - Application: http://localhost:3002 (single port for all modes)"
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
                    # In single-port mode, client is served by server
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
                    stop_process "server"
                    # In single-port mode, stopping server stops everything
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
            stop_process "server" true
            
            # Also kill any remaining processes on port 3002
            local remaining_pids=$(lsof -ti :3002 2>/dev/null)
            if [ -n "$remaining_pids" ]; then
                log_warning "Force killing remaining processes on port 3002..."
                echo "$remaining_pids" | xargs kill -9 2>/dev/null || true
            fi
            
            # Clean up any stale PID files
            rm -f "$PID_DIR"/*.pid
            log_success "Force stop completed"
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
                    stop_process "server"
                    sleep 2
                    check_dependencies "server"
                    start_server
                    # In single-port mode, server handles everything
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
            
        "deploy")
            log_header "Deploying latest code"
            
            # Stop all processes
            log_info "Stopping all processes..."
            stop_process "server" true
            
            # Pull latest code
            log_info "Pulling latest code from repository..."
            cd "$PROJECT_ROOT"
            git pull origin main || log_warning "Git pull failed or not in a git repository"
            
            # Install dependencies
            log_info "Installing dependencies..."
            npm install
            cd "$CLIENT_DIR" && npm install && cd "$PROJECT_ROOT"
            cd "$SERVER_DIR" && npm install && cd "$PROJECT_ROOT"
            
            # Build client
            log_info "Building client..."
            cd "$CLIENT_DIR"
            npm run build
            cd "$PROJECT_ROOT"
            
            # Wait a moment
            sleep 2
            
            # Start server
            log_info "Starting server..."
            check_dependencies "server"
            start_server
            
            echo ""
            show_status
            log_success "Deployment completed!"
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