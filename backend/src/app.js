const express = require('express');
const cors = require('cors');
const authRoutes = require('./routes/auth');
const testRoutes = require('./routes/tests');
const candidateRoutes = require('./routes/candidates');
const assessmentRoutes = require('./routes/assessments');
const questionRoutes = require('./routes/questions');

const app = express();

app.use(cors());
app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/tests', testRoutes);
app.use('/api/candidates', candidateRoutes);
app.use('/api/assessments', assessmentRoutes);
app.use('/api/questions', questionRoutes);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
}); 