# Memory Optimization Guide

## 🧠 Memory Issues & Solutions

### Common Memory Problems
- **JavaScript heap out of memory** during build/compilation
- **Large TypeScript projects** consuming excessive memory
- **Node.js default memory limits** (1.4GB on 64-bit systems)

## 🔧 Applied Fixes

### 1. **Increased Node.js Memory Limits**
- **Build Process**: 4GB memory limit for TypeScript compilation and Vite builds
- **Runtime**: 2GB memory limit for production server
- **Development**: Standard limits (sufficient for dev mode)

### 2. **Updated Scripts**
```json
// server/package.json
"build": "node --max-old-space-size=4096 ./node_modules/typescript/bin/tsc"
"start": "node --max-old-space-size=2048 dist/index.js"

// client/package.json  
"build": "node --max-old-space-size=4096 ./node_modules/vite/bin/vite.js build"
```

### 3. **App Management Script**
- Production server starts with 2GB memory limit
- Development mode uses standard limits

## 🚀 Usage

### Build with Increased Memory
```bash
# Client build (4GB limit)
cd client && npm run build

# Server build (4GB limit)  
cd server && npm run build

# Full build
npm run build
```

### Run with Increased Memory
```bash
# Production (2GB limit)
./scripts/app.sh start

# Development (standard limits)
npm run dev
```

## 📊 Memory Recommendations

### **Development Environment**
- **Minimum**: 8GB RAM
- **Recommended**: 16GB RAM
- **Optimal**: 32GB RAM

### **Production Environment**
- **Minimum**: 4GB RAM
- **Recommended**: 8GB RAM
- **Server Process**: ~2GB allocated

### **Build Environment**
- **Minimum**: 8GB RAM
- **Temporary**: Up to 4GB during build process
- **CI/CD**: Ensure build agents have sufficient memory

## 🔍 Monitoring Memory Usage

### Check Current Memory Usage
```bash
# Server process memory
ps aux | grep "node.*dist/index.js"

# Build process memory (during build)
ps aux | grep "node.*tsc\|node.*vite"

# System memory
free -h  # Linux
vm_stat  # macOS
```

### Memory Optimization Tips
1. **Close unnecessary applications** during build
2. **Use incremental builds** when possible
3. **Monitor system memory** before starting builds
4. **Consider using swap space** if RAM is limited

## 🆘 Troubleshooting

### If Memory Issues Persist
1. **Increase limits further**:
   ```bash
   # 8GB limit (extreme cases)
   node --max-old-space-size=8192 ./node_modules/typescript/bin/tsc
   ```

2. **Check for memory leaks**:
   ```bash
   # Monitor memory during build
   watch -n 1 'ps aux | grep node'
   ```

3. **Use build optimization**:
   ```bash
   # TypeScript incremental builds
   tsc --incremental
   
   # Vite build optimization
   vite build --minify false  # Disable minification if needed
   ```

4. **System-level solutions**:
   - Add swap space (Linux/macOS)
   - Close memory-intensive applications
   - Restart system to clear memory

## 📈 Performance Impact

### Build Time vs Memory
- **Higher memory limits**: Faster builds, more memory usage
- **Lower memory limits**: Slower builds, risk of OOM errors
- **Optimal balance**: 4GB for builds, 2GB for runtime

### Production Considerations
- **2GB runtime limit**: Sufficient for most workloads
- **Automatic garbage collection**: Node.js manages memory efficiently
- **Monitor in production**: Use tools like PM2 or system monitoring

---

**Note**: These settings are optimized for the Investment Tracker application. Adjust based on your specific hardware and requirements.