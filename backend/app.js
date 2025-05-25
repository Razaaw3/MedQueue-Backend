const tokenRoutes = require('./routes/token');

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/token', tokenRoutes);
