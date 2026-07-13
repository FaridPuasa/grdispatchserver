import React from 'react'
import { useState, useEffect } from 'react';
import { Calendar, Search, Filter, TrendingUp, Calculator, Package, Clock, AlertTriangle, Users, TrendingDown, Settings, BarChart3, Activity, Database, ChevronDown, ChevronUp, Menu, X, MapPin, User, Truck, Eye, EyeOff, Warehouse, FileDown, PackageCheck, LogIn, LogOut } from 'lucide-react';
import { LineChart, XAxis, YAxis, CartesianGrid, Tooltip, Legend, Line, ResponsiveContainer, Bar } from 'recharts';
import { useAuth } from './AuthContext.jsx';
import Login from './Login.jsx';
import Navbar from './Navbar.jsx';

const App = () => {
  const { user, checkingSession, authFetch, API_BASE_URL } = useAuth();
  const [data, setData] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [expandedDispatchers, setExpandedDispatchers] = useState({});
  const [expandedSchedules, setExpandedSchedules] = useState({});
  const [comparisonData, setComparisonData] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [chartData, setChartData] = useState({
  dispatcher: {},
  company: null,
  timeRange: '90d' // 7d, 30d, 90d
});
const [sidebarWidth, setSidebarWidth] = useState(320);
const [useManualDriverCount, setUseManualDriverCount] = useState(false);
const [companyPrediction, setCompanyPrediction] = useState({
  monthlyParcels: '',
  dailyCapacity: 130,
  currentDrivers: '', // Add this new field
  loading: false,
  results: null
});
const [predictiveData, setPredictiveData] = useState({
  models: {},
  predictions: {},
  scenarios: {},
  recommendations: {}
});
const [customPrediction, setCustomPrediction] = useState({
  monthsAhead: 3,
  targetParcels: '',
  loading: false,
  results: null
});
const [analysisCompleted, setAnalysisCompleted] = useState(false);
const [bulkPrediction] = useState({
  loading: false,
  results: null
});
const [buildingModels, setBuildingModels] = useState(false);
const [selectedDispatcher, setSelectedDispatcher] = useState('');
const [isResizing, setIsResizing] = useState(false);
const [trackingLookup1, setTrackingLookup1] = useState({
  query: '',
  results: [],
  loading: false,
  error: '',
  lastSearch: ''
});

const [trackingLookup2, setTrackingLookup2] = useState({
  query: '',
  results: [],
  loading: false,
  error: '',
  lastSearch: ''
});
const [filters, setFilters] = useState({
  databaseName: 'GR_DMS',
  collectionName: 'orders',
  startDate: '',
  endDate: '',
  comparisonPeriod: true
});
const [exportSelection, setExportSelection] = useState({ mode: 'all', selected: [] });
const [exporting, setExporting] = useState(false);


  const generateDispatcherChart = (dispatcherName, scoreData) => {
  // Generate time series data for the dispatcher
  const timeSeriesData = [];
  const currentDate = new Date();
  
  // Create sample weekly data points (in real implementation, use actual historical data)
  for (let i = 11; i >= 0; i--) {
    const date = new Date(currentDate);
    date.setDate(date.getDate() - (i * 7));
    
    // Simulate performance fluctuation around actual score
    const baseScore = scoreData.overall_score;
    const variation = (Math.random() - 0.5) * 10; // ±5 point variation
    const simulatedScore = Math.max(0, Math.min(100, baseScore + variation));
    
    timeSeriesData.push({
      date: date.toISOString().split('T')[0],
      week: `Week ${12 - i}`,
      overallScore: Math.round(simulatedScore * 100) / 100,
      deliverySuccess: Math.round((scoreData.metrics.delivery_success_rate + (Math.random() - 0.5) * 5) * 100) / 100,
      onTimeRate: Math.round((scoreData.metrics.on_time_rate + (Math.random() - 0.5) * 8) * 100) / 100,
      throughput: Math.round((scoreData.metrics.throughput_per_day + (Math.random() - 0.5) * 1) * 100) / 100,
      completedJobs: Math.floor(scoreData.completed_jobs / 12 + (Math.random() - 0.5) * 5),
      totalJobs: Math.floor(scoreData.total_jobs / 12 + (Math.random() - 0.5) * 8)
    });
  }
  
  setChartData(prev => ({
    ...prev,
    dispatcher: {
      ...prev.dispatcher,
      [dispatcherName]: timeSeriesData
    }
  }));
};

const generateCompanyChart = () => {
  if (!data.data || Object.keys(data.data).length === 0) return;
  
  const dispatchers = Object.keys(data.data);
  const timeSeriesData = [];
  
  // Generate 12 weeks of company-wide data
  for (let i = 11; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - (i * 7));
    
    // Calculate actual totals from analysis period
const totalCompanyJobs = Object.values(data.data).reduce((sum, d) => sum + d.total_jobs, 0);
const totalCompanyCompleted = Object.values(data.data).reduce((sum, d) => sum + d.completed_jobs, 0);
const avgCompanyScore = Object.values(data.data).reduce((sum, d) => sum + d.overall_score, 0) / dispatchers.length;
const totalCompanyThroughputPerDay = Object.values(data.data).reduce((sum, d) => sum + d.metrics.throughput_per_day, 0);

// Calculate analysis period in days
const startDate = new Date(filters.startDate);
const endDate = new Date(filters.endDate);
const analysisPeriodDays = Math.max(1, (endDate - startDate) / (1000 * 60 * 60 * 24) + 1);
const analysisPeriodWeeks = Math.max(1, analysisPeriodDays / 7);

// Estimate weekly totals based on actual data
const weeklyJobsEstimate = Math.floor(totalCompanyJobs / analysisPeriodWeeks);
const weeklyCompletedEstimate = Math.floor(totalCompanyCompleted / analysisPeriodWeeks);


// Add realistic variation for this week
const weeklyVariation = (Math.random() - 0.5) * 0.2; // ±10% variation
const jobVariation = Math.floor(weeklyJobsEstimate * weeklyVariation);
const completedVariation = Math.floor(weeklyCompletedEstimate * weeklyVariation);

const weeklyJobs = Math.max(0, weeklyJobsEstimate + jobVariation);
const weeklyCompleted = Math.max(0, weeklyCompletedEstimate + completedVariation);
const weeklySuccessRate = weeklyJobs > 0 ? Math.round((weeklyCompleted / weeklyJobs) * 100 * 100) / 100 : 0;

timeSeriesData.push({
  date: date.toISOString().split('T')[0],
  week: `Week ${12 - i}`,
  avgScore: Math.round((avgCompanyScore + (avgCompanyScore * weeklyVariation)) * 100) / 100,
  totalJobs: weeklyJobs,
  completedJobs: weeklyCompleted, // This is now the total completed by ALL dispatchers for this week
  avgThroughput: Math.round((totalCompanyThroughputPerDay + (totalCompanyThroughputPerDay * weeklyVariation)) * 100) / 100,
  activeDispatchers: dispatchers.length,
  successRate: weeklySuccessRate
});
  }
  
  setChartData(prev => ({
    ...prev,
    company: timeSeriesData
  }));
};

const DispatcherChart = ({ data: chartData }) => {
  if (!chartData || chartData.length === 0) {
    return (
      <div className="text-center py-8">
        <BarChart3 className="w-12 h-12 text-gray-300 mx-auto mb-2" />
        <p className="text-sm text-gray-500">No chart data available</p>
      </div>
    );
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4">
      <h4 className="text-sm font-medium text-gray-700 mb-4">12-Week Performance Trend</h4>
      
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis 
              dataKey="week" 
              fontSize={10}
              angle={-45}
              textAnchor="end"
              height={60}
            />
            <YAxis fontSize={10} />
            <Tooltip 
              contentStyle={{ 
                backgroundColor: '#f8f9fa',
                border: '1px solid #e9ecef',
                borderRadius: '4px',
                fontSize: '12px'
              }}
            />
            <Legend fontSize={10} />
            <Line 
              type="monotone" 
              dataKey="overallScore" 
              stroke="#2563eb" 
              strokeWidth={2}
              name="Overall Score"
              dot={{ fill: '#2563eb', r: 3 }}
            />
            <Line 
              type="monotone" 
              dataKey="deliverySuccess" 
              stroke="#16a34a" 
              strokeWidth={1.5}
              name="Delivery Success %"
              dot={{ fill: '#16a34a', r: 2 }}
            />
            <Line 
              type="monotone" 
              dataKey="throughput" 
              stroke="#dc2626" 
              strokeWidth={1.5}
              name="Daily Throughput"
              dot={{ fill: '#dc2626', r: 2 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
      
      <div className="mt-4 grid grid-cols-3 gap-4 text-xs">
        <div className="text-center p-2 bg-blue-50 rounded">
          <div className="text-blue-600 font-medium">Latest Score</div>
          <div className="text-blue-800 font-bold">{chartData[chartData.length - 1]?.overallScore}%</div>
        </div>
        <div className="text-center p-2 bg-green-50 rounded">
          <div className="text-green-600 font-medium">Trend</div>
          <div className="text-green-800 font-bold">
            {chartData[chartData.length - 1]?.overallScore > chartData[0]?.overallScore ? '↗ Up' : '↘ Down'}
          </div>
        </div>
        <div className="text-center p-2 bg-purple-50 rounded">
          <div className="text-purple-600 font-medium">Avg Throughput</div>
          <div className="text-purple-800 font-bold">
            {(chartData.reduce((sum, d) => sum + d.throughput, 0) / chartData.length).toFixed(1)}
          </div>
        </div>
      </div>
    </div>
  );
};

const CompanyChart = ({ data: chartData }) => {
  if (!chartData || chartData.length === 0) return null;

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-800">Company Performance Overview</h3>
        <div className="flex items-center space-x-2 text-xs">
          <span className="text-gray-500">Last 12 weeks</span>
        </div>
      </div>
      
      <div className="h-80 mb-4">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="week" fontSize={11} />
            <YAxis yAxisId="score" domain={[0, 100]} fontSize={11} />
            <YAxis yAxisId="jobs" orientation="right" fontSize={11} />
            <Tooltip 
              contentStyle={{ 
                backgroundColor: '#f8f9fa',
                border: '1px solid #e9ecef',
                borderRadius: '6px'
              }}
            />
            <Legend />
            <Line 
              yAxisId="score"
              type="monotone" 
              dataKey="avgScore" 
              stroke="#3b82f6" 
              strokeWidth={3}
              name="Avg Company Score"
              dot={{ fill: '#3b82f6', r: 4 }}
            />
            <Line 
              yAxisId="score"
              type="monotone" 
              dataKey="successRate" 
              stroke="#10b981" 
              strokeWidth={2}
              name="Success Rate %"
              dot={{ fill: '#10b981', r: 3 }}
            />
            <Bar 
              yAxisId="jobs"
              dataKey="totalJobs" 
              fill="#e5e7eb" 
              name="Total Jobs"
              opacity={0.6}
            />
            <Bar 
              yAxisId="jobs"
              dataKey="completedJobs" 
              fill="#6366f1" 
              name="Completed Jobs"
              opacity={0.8}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
      
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="text-center p-3 bg-blue-50 rounded-lg">
          <div className="text-blue-600 text-xs font-medium">Current Avg Score</div>
          <div className="text-blue-800 text-lg font-bold">
            {chartData[chartData.length - 1]?.avgScore}%
          </div>
        </div>
        <div className="text-center p-3 bg-green-50 rounded-lg">
          <div className="text-green-600 text-xs font-medium">Success Rate</div>
          <div className="text-green-800 text-lg font-bold">
            {chartData[chartData.length - 1]?.successRate}%
          </div>
        </div>
        <div className="text-center p-3 bg-purple-50 rounded-lg">
          <div className="text-purple-600 text-xs font-medium">Weekly Jobs</div>
          <div className="text-purple-800 text-lg font-bold">
            {chartData[chartData.length - 1]?.totalJobs}
          </div>
        </div>
        <div className="text-center p-3 bg-indigo-50 rounded-lg">
          <div className="text-indigo-600 text-xs font-medium">Active Dispatchers</div>
          <div className="text-indigo-800 text-lg font-bold">
            {chartData[chartData.length - 1]?.activeDispatchers}
          </div>
        </div>
      </div>
    </div>
  );
};

const predictCompanyCapacity = async () => {
  if (!companyPrediction.monthlyParcels || companyPrediction.monthlyParcels <= 0) {
    setError('Please enter a valid number of monthly parcels');
    return;
  }

  setCompanyPrediction(prev => ({ ...prev, loading: true, results: null }));
  
  try {
    const monthlyParcels = parseInt(companyPrediction.monthlyParcels);
    const dailyCapacity = parseInt(companyPrediction.dailyCapacity);
    const currentDrivers = useManualDriverCount 
  ? parseInt(companyPrediction.currentDrivers) 
  : Object.keys(data.data || {}).length;
    
    // Enhanced working days calculation (account for holidays, sick days)
    const baseWorkingDays = 26; // More realistic than 26
    const effectiveWorkingDays = baseWorkingDays * 0.9; // 10% buffer for sick days/holidays
    
    // Calculate current team performance metrics
    const currentPerformanceData = Object.values(data.data || {});
    const avgPerformanceScore = currentPerformanceData.length > 0 
      ? currentPerformanceData.reduce((sum, driver) => sum + driver.overall_score, 0) / currentPerformanceData.length 
      : 75;
    
    const avgThroughput = currentPerformanceData.length > 0
      ? currentPerformanceData.reduce((sum, driver) => sum + driver.metrics.throughput_per_day, 0) / currentPerformanceData.length
      : dailyCapacity * 0.8;
    
    // Performance-adjusted capacity calculation
    const performanceMultiplier = Math.min(1.2, Math.max(0.6, avgPerformanceScore / 85));
    const adjustedDailyCapacity = dailyCapacity * performanceMultiplier;
    const parcelsPerDriverPerMonth = adjustedDailyCapacity * effectiveWorkingDays;
    
    // Seasonal and growth factor adjustments
    const seasonalFactor = 1.1; // 10% seasonal peak buffer
    const adjustedMonthlyTarget = monthlyParcels * seasonalFactor;
    
    // Required drivers calculation with efficiency scaling
    const baseRequiredDrivers = adjustedMonthlyTarget / parcelsPerDriverPerMonth;
    const efficiencyLoss = Math.max(0, (baseRequiredDrivers - currentDrivers) * 0.05); // 5% loss per additional driver
    const requiredDrivers = Math.ceil(baseRequiredDrivers * (1 + efficiencyLoss));
    
    const additionalDriversNeeded = Math.max(0, requiredDrivers - currentDrivers);
    
    // Advanced utilization calculation
    const currentCapacity = currentDrivers * parcelsPerDriverPerMonth;
    const utilizationPercentage = Math.min(150, (adjustedMonthlyTarget / currentCapacity) * 100);
    
    // Risk assessment
    const riskFactors = [];
    if (utilizationPercentage > 95) riskFactors.push("Extreme overutilization risk");
    if (avgPerformanceScore < 70) riskFactors.push("Low team performance baseline");
    if (additionalDriversNeeded > currentDrivers * 0.3) riskFactors.push("Major scaling challenge");
    
    // Confidence calculation with multiple factors
    let confidenceLevel, confidenceColor, confidenceScore;
    
    const perfFactor = Math.max(0, Math.min(1, (avgPerformanceScore - 50) / 40));
    const utilFactor = utilizationPercentage <= 85 ? 1 : Math.max(0, (100 - utilizationPercentage) / 15);
    const scaleFactor = additionalDriversNeeded <= 2 ? 1 : Math.max(0.3, 1 - (additionalDriversNeeded / 10));
    
    confidenceScore = (perfFactor * 0.4 + utilFactor * 0.4 + scaleFactor * 0.2) * 100;
    
    if (confidenceScore >= 75) {
      confidenceLevel = 'High';
      confidenceColor = 'text-green-600';
    } else if (confidenceScore >= 50) {
      confidenceLevel = 'Medium';
      confidenceColor = 'text-yellow-600';
    } else {
      confidenceLevel = 'Low';
      confidenceColor = 'text-red-600';
    }
    
    // Cost estimation
    const estimatedMonthlyCostPerDriver = 500; // Base salary estimate
    const additionalMonthlyCost = additionalDriversNeeded * estimatedMonthlyCostPerDriver;
    
    // Timeline estimation
    let implementationTimeline;
    if (additionalDriversNeeded === 0) {
      implementationTimeline = "Immediate - no additional drivers needed";
    } else if (additionalDriversNeeded <= 2) {
      implementationTimeline = "2-4 weeks (recruitment + basic training)";
    } else if (additionalDriversNeeded <= 5) {
      implementationTimeline = "6-8 weeks (recruitment + training + integration)";
    } else {
      implementationTimeline = "10-12 weeks (phased recruitment + comprehensive training)";
    }
    
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    setCompanyPrediction(prev => ({
      ...prev,
      loading: false,
      results: {
        monthlyParcels,
        adjustedMonthlyTarget,
        dailyCapacity,
        adjustedDailyCapacity: Math.round(adjustedDailyCapacity),
        requiredDrivers,
        currentDrivers,
        additionalDriversNeeded,
        utilizationPercentage: utilizationPercentage.toFixed(1),
        confidenceLevel,
        confidenceColor,
        confidenceScore: Math.round(confidenceScore),
        parcelsPerDriverPerMonth: Math.round(parcelsPerDriverPerMonth),
        effectiveWorkingDays: Math.round(effectiveWorkingDays),
        avgPerformanceScore: Math.round(avgPerformanceScore),
        avgThroughput: Math.round(avgThroughput * 10) / 10,
        performanceMultiplier: Math.round(performanceMultiplier * 100) / 100,
        seasonalFactor,
        riskFactors,
        additionalMonthlyCost,
        implementationTimeline,
        currentCapacity: Math.round(currentCapacity),
        projectedDeficit: Math.max(0, Math.round(adjustedMonthlyTarget - currentCapacity))
      }
    }));
    
  } catch (err) {
    setError(err.message);
    setCompanyPrediction(prev => ({ ...prev, loading: false }));
  }
};

const pollJob = async (jobId, { intervalMs = 2000, timeoutMs = 300000 } = {}) => {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const response = await authFetch(`${API_BASE_URL}/api/jobs/${jobId}`);
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || 'Failed to check job status');
    }
    const job = await response.json();
    if (job.status === 'done') return job.result;
    if (job.status === 'error') throw new Error(job.error || 'Job failed');
    await new Promise(resolve => setTimeout(resolve, intervalMs));
  }
  throw new Error('Timed out waiting for the job to finish');
};

const buildPredictionModels = async () => {
  if (!filters.databaseName || !filters.collectionName) {
    setError('Database name and collection name are required');
    return;
  }

  setBuildingModels(true);
  try {
    const response = await authFetch(`${API_BASE_URL}/api/build-prediction-models`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        database_name: filters.databaseName,
        collection_name: filters.collectionName
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to build prediction models');
    }

    const { job_id } = await response.json();
    const result = await pollJob(job_id);
    setPredictiveData(prev => ({
      ...prev,
      models: result.models_built || {}
    }));
    
    // Show success message
    setError('');
    const successCount = Object.values(result.models_built || {}).filter(model => !model.error).length;
    alert(`Successfully built ${successCount} ARIMA prediction models out of ${result.total_models} attempts`);
  } catch (err) {
    setError(err.message);
    console.error('Error building prediction models:', err);
  } finally {
    setBuildingModels(false);
  }
};

const predictPerformance = async (dispatcherName, monthsAhead = 3) => {
  try {
    const response = await authFetch(`${API_BASE_URL}/api/custom-prediction`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        dispatcher: dispatcherName,
        months_ahead: monthsAhead,
        target_parcels_per_month: null // or specify a target if you want capacity analysis
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to predict performance');
    }

    const { job_id } = await response.json();
    const result = await pollJob(job_id);
    setPredictiveData(prev => ({
      ...prev,
      predictions: {
        ...prev.predictions,
        [dispatcherName]: result.arima_prediction
      }
    }));
    
    return result.arima_prediction;
  } catch (err) {
    setError(err.message);
    console.error('Error predicting performance:', err);
    return null;
  }
};

// 2. Add new function for performance drivers (around line 125)
const getPerformanceDrivers = async (dispatcherName) => {
  try {
    // This endpoint doesn't exist in your backend yet, so we'll simulate it
    // You can implement this later or remove this function
    console.log(`Performance drivers analysis not yet implemented for ${dispatcherName}`);
    return null;
  } catch (err) {
    setError(err.message);
    console.error('Error getting performance drivers:', err);
    return null;
  }
};

const runCustomPrediction = async () => {
  if (!selectedDispatcher) {
    setError('Please select a dispatcher first');
    return;
  }

  console.log('Sending prediction request:', {
    dispatcher: selectedDispatcher,
    months_ahead: customPrediction.monthsAhead,
    target_parcels_per_month: customPrediction.targetParcels ? parseInt(customPrediction.targetParcels) : null,
    daily_capacity: customPrediction.dailyCapacity ? parseInt(customPrediction.dailyCapacity) : null // Add this
  });

  setCustomPrediction(prev => ({ ...prev, loading: true, results: null }));
  
  try {
    const response = await authFetch(`${API_BASE_URL}/api/custom-prediction`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        dispatcher: selectedDispatcher,
        months_ahead: customPrediction.monthsAhead,
        target_parcels_per_month: customPrediction.targetParcels ? parseInt(customPrediction.targetParcels) : null,
        daily_capacity: customPrediction.dailyCapacity ? parseInt(customPrediction.dailyCapacity) : null // Add this
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to generate custom prediction');
    }

    const { job_id } = await response.json();
    const result = await pollJob(job_id);
    console.log('Prediction response:', result);
    setCustomPrediction(prev => ({ ...prev, results: result.arima_prediction || result, loading: false }));
  } catch (err) {
    console.error('Prediction error:', err);
    setError(err.message);
    setCustomPrediction(prev => ({ ...prev, loading: false }));
  }
};

// Set default dates (last 30 days)
useEffect(() => {
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - 30);
  
  setFilters(prev => ({
    ...prev,
    startDate: startDate.toISOString().split('T')[0],
    endDate: endDate.toISOString().split('T')[0]
  }));
}, []);

// Handle sidebar resizing
const handleMouseDown = () => {
  setIsResizing(true);
  document.body.style.cursor = 'col-resize';
  document.body.style.userSelect = 'none';
};

useEffect(() => {
  const handleMouseMove = (e) => {
    if (!isResizing) return;
    
    const newWidth = Math.max(20, Math.min(600, e.clientX));

    setSidebarWidth(newWidth);
  };

  const handleMouseUp = () => {
    setIsResizing(false);
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
  };

  if (isResizing) {
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }

  return () => {
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
  };
}, [isResizing]);

  const fetchProductivityData = async () => {
    if (!filters.databaseName || !filters.collectionName || !filters.startDate || !filters.endDate) {
      setError('Please provide database name, collection name, and date range');
      return;
    }

    setLoading(true);
    setError('');
    setComparisonData(null);

    try {
      // Fetch productivity data
      const response = await authFetch(`${API_BASE_URL}/api/productivity`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          database_name: filters.databaseName,
          collection_name: filters.collectionName,
          start_date: filters.startDate,
          end_date: filters.endDate,
          group_by: 'dispatcher',
          include_area_stats: true,
          comparison_period: filters.comparisonPeriod
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch data');
      }

      const result = await response.json();
      setData(result);
      setAnalysisCompleted(true);
      
      // If comparison data is available, set it
      if (result.comparison_data) {
        setComparisonData(result.comparison_data);
      }
    } catch (err) {
      setError(err.message);
      setAnalysisCompleted(false);
      console.error('Error fetching productivity data:', err);
    } finally {
      setLoading(false);
    }
  };

  const toggleExportDispatcher = (name) => {
    setExportSelection(prev => ({
      ...prev,
      selected: prev.selected.includes(name)
        ? prev.selected.filter(n => n !== name)
        : [...prev.selected, name]
    }));
  };

  const handleExportReport = async () => {
    setExporting(true);
    setError('');
    try {
      const dispatchers = exportSelection.mode === 'all' ? 'all' : exportSelection.selected;
      const response = await authFetch(`${API_BASE_URL}/api/export-report`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          database_name: filters.databaseName,
          collection_name: filters.collectionName,
          start_date: filters.startDate,
          end_date: filters.endDate,
          dispatchers
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to export report');
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `dispatcher-report-${filters.startDate}-to-${filters.endDate}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err.message);
      console.error('Error exporting report:', err);
    } finally {
      setExporting(false);
    }
  };

const searchTrackingNumber = async (trackingNumber, lookupIndex = 1) => {
  if (!trackingNumber.trim() || !filters.databaseName || !filters.collectionName) {
    return;
  }

  const setLookupState = lookupIndex === 1 ? setTrackingLookup1 : setTrackingLookup2;
  setLookupState(prev => ({ ...prev, loading: true, error: '', lastSearch: trackingNumber }));

  try {
    const response = await authFetch(`${API_BASE_URL}/api/tracking-lookup`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        tracking_number: trackingNumber,
        database_name: filters.databaseName,
        collection_name: filters.collectionName
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to search tracking number');
    }

    const result = await response.json();
    setLookupState(prev => ({
      ...prev,
      results: result.jobs || [],
      loading: false,
      error: result.jobs?.length === 0 ? `No results found for "${trackingNumber}"` : ''
    }));
  } catch (err) {
    setLookupState(prev => ({
      ...prev,
      results: [],
      loading: false,
      error: err.message
    }));
  }
};

// Replace the entire function with:
const runScenarioAnalysis = async (dispatcherName) => {
  try {
    const scenarios = {
      'More Deliveries': {
        'description': 'Handling 30% more packages per day',
        'total_jobs': 1.3
      },
      'Better Quality Focus': {
        'description': 'Improving completion rate by 10% and reducing delays',
        'completion_rate': 1.1, 
        'avg_completion_gap': 0.8
      },
      'Optimized Routes': {
        'description': 'Better route planning and 15% faster delivery',
        'area_diversity': 0.7, 
        'throughput_per_day': 1.15
      }
    };

    const response = await authFetch(`${API_BASE_URL}/api/scenario-analysis`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        dispatcher: dispatcherName,
        scenarios: scenarios
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to run scenario analysis');
    }

    const { job_id } = await response.json();
    const result = await pollJob(job_id);
    setPredictiveData(prev => ({
      ...prev,
      scenarios: {
        ...prev.scenarios,
        [dispatcherName]: result.scenarios
      }
    }));
    
    return result;
  } catch (err) {
    setError(err.message);
    console.error('Error running scenario analysis:', err);
    return null;
  }
};

const handleTrackingSearch = (e, lookupIndex = 1) => {
  e.preventDefault();
  const query = lookupIndex === 1 ? trackingLookup1.query : trackingLookup2.query;
  searchTrackingNumber(query, lookupIndex);
};

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const toggleDispatcherExpanded = (dispatcherName) => {
    setExpandedDispatchers(prev => ({
      ...prev,
      [dispatcherName]: !prev[dispatcherName]
    }));
  };

  const toggleScheduleExpanded = (dispatcherName) => {
    setExpandedSchedules(prev => ({
      ...prev,
      [dispatcherName]: !prev[dispatcherName]
    }));
  };

  const getScoreBadgeColor = (score) => {
    if (score >= 85) return 'bg-green-100 text-green-800';
    if (score >= 70) return 'bg-yellow-100 text-yellow-800';
    return 'bg-red-100 text-red-800';
  };

  const getStatusColor = (status) => {
    const colors = {
      'Completed': 'text-green-600 bg-green-100',
      'Out for Delivery': 'text-blue-600 bg-blue-100',
      'At Warehouse': 'text-blue-600 bg-blue-100',
      'Info Received': 'text-yellow-600 bg-yellow-100',
      'On Hold': 'text-orange-600 bg-orange-100',
      'Return to Warehouse': 'text-orange-600 bg-orange-100',
      'Return': 'text-red-600 bg-red-100',
      'Cancelled': 'text-red-600 bg-red-100'
    };
    return colors[status] || 'text-gray-600 bg-gray-100';
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return 'N/A';
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
    } catch {
      return dateStr;
    }
  };

  const getComparisonIndicator = (current, previous) => {
    if (previous === undefined || previous === null || previous === 0 || current === previous) return null;
    
    const change = ((current - previous) / previous) * 100;
    const isPositive = change >= 0;
    
    return (
      <span className={`ml-2 text-xs font-medium ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
        {isPositive ? '↑' : '↓'} {Math.abs(change).toFixed(1)}%
      </span>
    );
  };

  const MetricCard = ({ title, value, subtitle, icon: IconComponent, color = 'blue', comparisonValue }) => (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-600">{title}</p>
          <div className="flex items-center">
            <p className={`text-3xl font-bold text-${color}-600 mt-2`}>
              {value}
            </p>
            {getComparisonIndicator(value, comparisonValue)}
          </div>
          {subtitle && <p className="text-sm text-gray-500 mt-1">{subtitle}</p>}
        </div>
        {IconComponent && (
          <div className={`p-3 rounded-full bg-${color}-50`}>
            <IconComponent className={`w-6 h-6 text-${color}-600`} />
          </div>
        )}
      </div>
    </div>
  );


const AreaDistribution = ({ areas }) => {
  if (!areas || Object.keys(areas).length === 0) {
    return (
      <div className="p-3 bg-gray-50 rounded-lg">
        <p className="text-xs text-gray-500">No area data available</p>
      </div>
    );
  }

  const total = Object.values(areas).reduce((sum, count) => sum + count, 0);
  
  return (
    <div className="space-y-2">
      {Object.entries(areas)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 5) // Show top 5 areas
        .map(([area, count]) => {
          const percentage = ((count / total) * 100).toFixed(1);
          return (
            <div key={area} className="flex items-center justify-between text-xs">
              <span className="text-gray-600 truncate flex-1 mr-2">{area}</span>
              <div className="flex items-center space-x-2 flex-shrink-0">
                <div className="w-16 bg-gray-200 rounded-full h-1.5">
                  <div 
                    className="bg-blue-500 h-1.5 rounded-full" 
                    style={{ width: `${percentage}%` }}
                  ></div>
                </div>
                <span className="text-gray-700 w-16 text-right text-xs">{count} ({percentage}%)</span>
              </div>
            </div>
          );
        })}
      {Object.keys(areas).length > 5 && (
        <div className="text-xs text-gray-400 text-center pt-1">
          +{Object.keys(areas).length - 5} more areas
        </div>
      )}
    </div>
  );
};

const ScenarioTranslation = ({ scenarios, currentScore, dispatcherName }) => {
  const getSimpleExplanation = (scenarioName, result) => {
    const change = result.predicted_change;
    const newScore = result.predicted_score;
    
    switch(scenarioName) {
      case 'More Deliveries':
        return {
          title: '📦 Handling More Packages',
          explanation: change > 0 
            ? `If ${dispatcherName} handles 30% more deliveries per day, their performance score could improve by ${Math.abs(change)}% (from ${currentScore}% to ${newScore}%).`
            : `If ${dispatcherName} handles 30% more deliveries per day, their performance score might drop by ${Math.abs(change)}% (from ${currentScore}% to ${newScore}%). This suggests they're already at or near capacity.`,
          impact: change > 0 ? 'positive' : 'negative',
          recommendation: change > 0 ? 'This dispatcher could handle more volume effectively.' : 'Consider training or support before increasing workload.'
        };
        
      case 'Better Quality Focus':
        return {
          title: '🎯 Focus on Quality',
          explanation: `By improving completion rates and reducing delays, ${dispatcherName}'s performance score could increase by ${change}% (from ${currentScore}% to ${newScore}%).`,
          impact: 'positive',
          recommendation: 'Quality improvements almost always boost performance scores.'
        };
        
      case 'Optimized Routes':
        return {
          title: '🗺️ Better Route Planning',
          explanation: `With optimized routes and faster delivery methods, ${dispatcherName}'s performance score could improve by ${change}% (from ${currentScore}% to ${newScore}%).`,
          impact: 'positive',
          recommendation: 'Route optimization is a reliable way to improve efficiency.'
        };
        
      default:
        return null;
    }
  };

  return (
    <div className="mt-4 bg-blue-50 border border-blue-200 rounded-lg p-4">
      <h5 className="text-sm font-medium text-blue-800 mb-3">📊 What This Means in Simple Terms</h5>
      
      <div className="space-y-3">
        {Object.entries(scenarios).map(([scenarioName, result]) => {
          const translation = getSimpleExplanation(scenarioName, result);
          if (!translation) return null;
          
          return (
            <div key={scenarioName} className="bg-white p-3 rounded border">
              <div className="flex items-start space-x-2">
                <div className="flex-1">
                  <h6 className="font-medium text-gray-800">{translation.title}</h6>
                  <p className="text-sm text-gray-600 mt-1">{translation.explanation}</p>
                  <div className="mt-2">
                    <span className={`text-xs px-2 py-1 rounded-full ${
                      translation.impact === 'positive' 
                        ? 'bg-green-100 text-green-700' 
                        : 'bg-red-100 text-red-700'
                    }`}>
                      {translation.recommendation}
                    </span>
                  </div>
                </div>
                <div className={`text-lg font-bold ${
                  result.predicted_change > 0 ? 'text-green-600' : 'text-red-600'
                }`}>
                  {result.predicted_change > 0 ? '+' : ''}{result.predicted_change}%
                </div>
              </div>
            </div>
          );
        })}
      </div>
      
      <div className="mt-3 text-xs text-blue-700 bg-blue-100 p-2 rounded">
        <strong>Key Insight:</strong> {dispatcherName} currently scores {currentScore}%. 
        The analysis suggests that quality improvements and route optimization would be most beneficial, 
        while significantly increasing delivery volume might reduce performance quality.
      </div>
    </div>
  );
};

const GapAnalysisCard = ({ completionGaps, isCompact = false }) => {
  const [expandedDays, setExpandedDays] = useState({});
  
  if (!completionGaps || completionGaps.total_gaps === 0) {
    return (
      <div className={`p-3 bg-green-50 border border-green-200 rounded-lg ${isCompact ? 'text-xs' : ''}`}>
        <div className="flex items-center space-x-2">
          <Clock className="w-4 h-4 text-green-600" />
          <span className="text-sm font-medium text-green-800">No Completion Gaps</span>
        </div>
        <p className="text-xs text-green-700 mt-1">All deliveries completed within 30-minute intervals</p>
      </div>
    );
  }

  const toggleDayExpanded = (date) => {
    setExpandedDays(prev => ({
      ...prev,
      [date]: !prev[date]
    }));
  };

  const hasHighGaps = completionGaps.total_gaps > 3 || completionGaps.max_gap_minutes > 120;
  
return (
  <div className={`p-3 border rounded-lg ${hasHighGaps ? 'bg-red-50 border-red-200' : 'bg-yellow-50 border-yellow-200'}`}>
    <div className="flex items-center justify-between mb-2">
      <div className="flex items-center space-x-2">
        <AlertTriangle className={`w-4 h-4 ${hasHighGaps ? 'text-red-600' : 'text-yellow-600'}`} />
        <span className={`text-sm font-medium ${hasHighGaps ? 'text-red-800' : 'text-yellow-800'}`}>
          Completion Gaps Detected
        </span>
      </div>
      <span className={`px-2 py-1 rounded text-xs font-medium ${hasHighGaps ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'}`}>
        {completionGaps.total_gaps} gaps
      </span>
    </div>
    
    <div className="grid grid-cols-2 gap-3 mb-2 text-xs">
      <div>
        <span className="text-gray-600">Avg Gap:</span>
        <span className="ml-1 font-medium">{completionGaps.avg_gap_minutes}min</span>
      </div>
      <div>
        <span className="text-gray-600">Max Gap:</span>
        <span className="ml-1 font-medium">{completionGaps.max_gap_minutes}min</span>
      </div>
    </div>
    
    {/* Show only first few flagged days, with option to expand */}
    {Object.entries(completionGaps.flagged_days)
      .slice(0, isCompact ? 2 : 10)
      .map(([date, dayData]) => (
      <div key={date} className="mb-2 last:mb-0">
        <button 
          onClick={() => toggleDayExpanded(date)}
          className="flex items-center justify-between w-full p-2 bg-white bg-opacity-50 rounded hover:bg-opacity-70 transition-colors"
        >
          <div className="flex items-center">
            <span className="text-xs font-medium text-gray-700 mr-2">{date}</span>
            <span className="text-xs text-gray-500">
              ({dayData.total_gaps} gaps in {dayData.total_jobs} jobs)
            </span>
          </div>
          {expandedDays[date] ? (
            <ChevronUp className="w-4 h-4 text-gray-500" />
          ) : (
            <ChevronDown className="w-4 h-4 text-gray-500" />
          )}
        </button>
        
        {expandedDays[date] && (
          <div className="mt-2 p-2 bg-white bg-opacity-60 rounded">
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {dayData.gaps.slice(0, 5).map((gap, index) => (
                  <div key={index} className="flex items-center justify-between text-xs p-2 rounded border border-gray-100">
                    <div className="flex-1 min-w-0">
                      <div className="font-mono text-gray-800 text-xs mb-1 truncate">
                        {gap.prev_track || 'Unknown'} → {gap.current_track || "Unknown"}
                      </div>
                      <div className="text-gray-600 text-xs truncate">
                        {gap.prev_postal || 'N/A'} → {gap.current_postal || 'N/A'}
                      </div>
                    </div>
                    <div className="text-right ml-2 flex-shrink-0">
                      <div className="font-medium text-gray-800">{gap.gap_formatted}</div>
                      <div className="text-gray-500 text-xs">{gap.prev_completion} → {gap.current_completion}</div>
                    </div>
                  </div>
                ))}
              {dayData.gaps.length > 5 && (
                <div className="text-xs text-gray-400 text-center py-1">
                  +{dayData.gaps.length - 5} more gaps
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    ))}
  </div>
);
};

const ProductivityCard = ({ name, scoreData, comparisonData }) => (
  <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 hover:shadow-md transition-shadow">
    <div className="flex items-center justify-between mb-4">
      <h3 className="text-lg font-semibold text-gray-800">{name}</h3>
      <div className="flex items-center space-x-2">
        <span className={`px-3 py-1 rounded-full text-sm font-medium ${getScoreBadgeColor(scoreData.overall_score)}`}>
          {scoreData.overall_score}%
          {comparisonData && getComparisonIndicator(scoreData.overall_score, comparisonData.overall_score)}
        </span>
        <button 
          onClick={() => toggleDispatcherExpanded(name)}
          className="p-1 hover:bg-gray-100 rounded transition-colors"
        >
          {expandedDispatchers[name] ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
      </div>
    </div>
      
    <div className="space-y-3">
      {/* Main Metrics */}
      <div className="flex justify-between items-center">
        <span className="text-sm text-gray-600">Delivery Success</span>
        <div className="flex items-center space-x-2">
          <div className="w-32 bg-gray-200 rounded-full h-2">
            <div 
              className="bg-blue-500 h-2 rounded-full transition-all duration-300" 
              style={{ width: `${scoreData.metrics.delivery_success_rate}%` }}
            ></div>
          </div>
          <span className="text-sm font-medium text-gray-700">
            {scoreData.metrics.delivery_success_rate}%
            {comparisonData && getComparisonIndicator(scoreData.metrics.delivery_success_rate, comparisonData.metrics.delivery_success_rate)}
          </span>
        </div>
      </div>
        
      <div className="flex justify-between items-center">
        <span className="text-sm text-gray-600">On-Time Rate</span>
        <div className="flex items-center space-x-2">
          <div className="w-32 bg-gray-200 rounded-full h-2">
            <div 
              className="bg-green-500 h-2 rounded-full transition-all duration-300" 
              style={{ width: `${scoreData.metrics.on_time_rate}%` }}
            ></div>
          </div>
          <span className="text-sm font-medium text-gray-700">
            {scoreData.metrics.on_time_rate}%
            {comparisonData && getComparisonIndicator(scoreData.metrics.on_time_rate, comparisonData.metrics.on_time_rate)}
          </span>
        </div>
      </div>
        
      <div className="flex justify-between items-center">
        <span className="text-sm text-gray-600">Throughput/Day</span>
        <span className="text-sm font-medium text-gray-700">
          {scoreData.metrics.throughput_per_day}
          {comparisonData && getComparisonIndicator(scoreData.metrics.throughput_per_day, comparisonData.metrics.throughput_per_day)}
        </span>
      </div>
        
      <div className="flex justify-between items-center text-xs text-gray-500 pt-2 border-t">
        <span>Total Jobs: {scoreData.total_jobs}</span>
        <span>Completed: {scoreData.completed_jobs}</span>
      </div>

      {/* Quick Summary Row - Always Visible */}
      <div className="grid grid-cols-2 gap-4 pt-2 border-t">
        <div className="text-xs">
          <span className="text-gray-500">Completion Gaps:</span>
          <div className="mt-1">
            {scoreData.completion_gaps ? (
              scoreData.completion_gaps.total_gaps === 0 ? (
                <span className="inline-flex items-center px-2 py-1 rounded-full bg-green-100 text-green-700 text-xs">
                  <Clock className="w-3 h-3 mr-1" />
                  None
                </span>
              ) : (
                <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs ${
                  scoreData.completion_gaps.total_gaps > 3 ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'
                }`}>
                  <AlertTriangle className="w-3 h-3 mr-1" />
                  {scoreData.completion_gaps.total_gaps} gaps
                </span>
              )
            ) : (
              <span className="text-gray-400">N/A</span>
            )}
          </div>
        </div>
        
        <div className="text-xs">
          <span className="text-gray-500">ML Model:</span>
          <div className="mt-1">
            {predictiveData.models[name] ? (
              predictiveData.models[name].error ? (
                <span className="inline-flex items-center px-2 py-1 rounded-full bg-red-100 text-red-700 text-xs">
                  Error
                </span>
              ) : (
                <span className="inline-flex items-center px-2 py-1 rounded-full bg-green-100 text-green-700 text-xs">
                  <TrendingUp className="w-3 h-3 mr-1" />
                  ARIMA Ready
                </span>
              )
            ) : (
              <span className="text-gray-400">Not Built</span>
            )}
          </div>
        </div>
      </div>

      {/* Expanded Details */}
      {expandedDispatchers[name] && (
        <div className="space-y-4 pt-4 border-t">
          {/* Chart Generation */}
    <div>
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-sm font-medium text-gray-700 flex items-center">
          <BarChart3 className="w-4 h-4 mr-2" />
          Performance Chart
        </h4>
        <button
          onClick={() => generateDispatcherChart(name, scoreData)}
          style={{
  backgroundColor: '#2563EB',  // bg-blue-600
  color: '#FFFFFF',            // text-white
  padding: '0.5rem 1.5rem',    // py-2 px-6
  borderRadius: '0.5rem',      // rounded-lg
  fontWeight: 500,             // font-medium
  display: 'flex',             // flex
  alignItems: 'center',        // items-center
  gap: '0.5rem',               // space-x-2
  transition: 'background-color 0.2s', // transition-colors
  cursor: 'pointer',           // default cursor
}}
                
          
        >
          Generate Chart
        </button>
      </div>
      {chartData.dispatcher[name] ? (
        <DispatcherChart dispatcherName={name} data={chartData.dispatcher[name]} />
      ) : (
        <div className="text-center py-4 text-sm text-gray-500">
          Click "Generate Chart" to view performance trends
        </div>
      )}
    </div>
          {/* Completion Gaps Analysis */}
          {scoreData.completion_gaps && (
            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-2 flex items-center">
                <Clock className="w-4 h-4 mr-2" />
                Completion Gap Analysis
              </h4>
              <GapAnalysisCard completionGaps={scoreData.completion_gaps} />
            </div>
          )}

          {/* Area Distribution */}
          <div>
            <h4 className="text-sm font-medium text-gray-700 mb-2 flex items-center">
              <BarChart3 className="w-4 h-4 mr-2" />
              Area Distribution
            </h4>
            <AreaDistribution areas={scoreData.area_distribution} />
          </div>

          {/* Additional Metrics */}
          <div>
            <h4 className="text-sm font-medium text-gray-700 mb-2 flex items-center">
              <Activity className="w-4 h-4 mr-2" />
              Additional Metrics
            </h4>
            <div className="grid grid-cols-2 gap-3 text-xs">

              <div className="p-2 bg-gray-50 rounded">
                <div className="text-gray-500">Route Difficulty</div>
                <div className="font-medium text-gray-800">{scoreData.metrics.route_difficulty_score}%</div>
              </div>
              <div className="p-2 bg-gray-50 rounded">
                <div className="text-gray-500 flex items-center"><LogOut className="w-3 h-3 mr-1" />Avg Departure</div>
                <div className="font-medium text-gray-800">{scoreData.schedule?.avg_start_time || 'N/A'}</div>
              </div>
              <div className="p-2 bg-gray-50 rounded">
                <div className="text-gray-500 flex items-center"><LogIn className="w-3 h-3 mr-1" />Avg End Time</div>
                <div className="font-medium text-gray-800">{scoreData.schedule?.avg_end_time || 'N/A'}</div>
              </div>
              <div className="p-2 bg-gray-50 rounded">
                <div className="text-gray-500">Days Worked</div>
                <div className="font-medium text-gray-800">{scoreData.schedule?.days_worked || 0}</div>
              </div>
            </div>

            {scoreData.schedule?.daily?.length > 0 && (
              <div className="mt-2">
                <button
                  onClick={() => toggleScheduleExpanded(name)}
                  className="flex items-center text-xs text-blue-600 hover:text-blue-800 font-medium"
                >
                  {expandedSchedules[name] ? <ChevronUp className="w-3 h-3 mr-1" /> : <ChevronDown className="w-3 h-3 mr-1" />}
                  {expandedSchedules[name] ? 'Hide' : 'View'} Daily Schedule ({scoreData.schedule.daily.length} day{scoreData.schedule.daily.length === 1 ? '' : 's'})
                </button>
                {expandedSchedules[name] && (
                  <div className="mt-2 max-h-48 overflow-y-auto border border-gray-100 rounded">
                    <table className="w-full text-xs">
                      <thead className="bg-gray-50 sticky top-0">
                        <tr>
                          <th className="px-2 py-1 text-left text-gray-500 font-medium">Date</th>
                          <th className="px-2 py-1 text-left text-gray-500 font-medium">Departure</th>
                          <th className="px-2 py-1 text-left text-gray-500 font-medium">End</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {scoreData.schedule.daily.map((day) => (
                          <tr key={day.date}>
                            <td className="px-2 py-1 text-gray-700">{day.date}</td>
                            <td className="px-2 py-1 text-gray-700">{day.start_time || 'N/A'}</td>
                            <td className="px-2 py-1 text-gray-700">{day.end_time || 'N/A'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ARIMA Predictive Analysis */}
          {predictiveData.models[name] && (
            <div className="space-y-4 pt-4 border-t">
              <h4 className="text-sm font-medium text-gray-700 mb-2 flex items-center">
                <TrendingUp className="w-4 h-4 mr-2 text-purple-600" />
                ARIMA Predictive Analysis
              </h4>
                
              {/* Model Status */}
              <div className="bg-purple-50 p-3 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-purple-800">Model Status</span>
                  {predictiveData.models[name].error ? (
                    <span className="text-xs bg-red-100 text-red-800 px-2 py-1 rounded-full">
                      Error
                    </span>
                  ) : (
                    <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded-full">
                      ARIMA Trained
                    </span>
                  )}
                </div>
                
                {predictiveData.models[name].error ? (
                  <p className="text-xs text-red-700">{predictiveData.models[name].error}</p>
                ) : (
                  <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <span className="text-purple-600">Training:</span>
                        <span className="ml-1 font-medium">{predictiveData.models[name].training_periods}w</span>
                      </div>
                    <div>
    <span className="text-purple-600">Validation R²:</span>
    <span className={`ml-1 font-medium ${predictiveData.models[name].validation_r2 > 0.3 ? 'text-green-600' : 'text-red-600'}`}>
      {predictiveData.models[name].validation_r2}
    </span>
  </div>
  {predictiveData.models[name].validation_mae && (
  <div className="mt-1 text-xs text-gray-600">
    Validation Error: ±{predictiveData.models[name].validation_mae}%
  </div>
)}
                  </div>
                )}
              </div>
              
              {/* Prediction Actions */}
              {!predictiveData.models[name].error && (
                <div className="flex space-x-2">
                  <button
                    onClick={() => predictPerformance(name)}
                    style={{
  backgroundColor: '#2563EB',  // bg-blue-600
  color: '#FFFFFF',            // text-white
  padding: '0.5rem 1.5rem',    // py-2 px-6
  borderRadius: '0.5rem',      // rounded-lg
  fontWeight: 500,             // font-medium
  display: 'flex',             // flex
  alignItems: 'center',        // items-center
  gap: '0.5rem',               // space-x-2
  transition: 'background-color 0.2s', // transition-colors
  cursor: 'pointer',           // default cursor
}}
                
          
                  >
                    Predict Next 3 Months
                  </button>
                  <button
                    onClick={() => runScenarioAnalysis(name)}
                    style={{
  backgroundColor: '#2563EB',  // bg-blue-600
  color: '#FFFFFF',            // text-white
  padding: '0.5rem 1.5rem',    // py-2 px-6
  borderRadius: '0.5rem',      // rounded-lg
  fontWeight: 500,             // font-medium
  display: 'flex',             // flex
  alignItems: 'center',        // items-center
  gap: '0.5rem',               // space-x-2
  transition: 'background-color 0.2s', // transition-colors
  cursor: 'pointer',           // default cursor
}}
                
          >
                    Run Scenarios
                  </button>
                </div>
              )}
              
              {/* Display ARIMA Predictions */}
              {predictiveData.predictions[name] && (
                <div className="bg-white border border-gray-200 rounded-lg p-3">
                  <h5 className="text-xs font-medium text-gray-700 mb-2">ARIMA Performance Predictions</h5>
                  <div className="space-y-2">
                    {predictiveData.predictions[name].predictions && predictiveData.predictions[name].predictions.map((prediction, index) => (
                      <div key={index} className="flex justify-between items-center text-xs">
                        <span className="text-gray-600">Month {prediction.month}:</span>
                        <div className="text-right">
                          <span className="font-medium text-gray-800">
                            {prediction.predicted_score}%
                          </span>
                          <div className="text-gray-400 text-xs">
                            ({prediction.confidence_lower}% - {prediction.confidence_upper}%)
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                  {predictiveData.predictions[name].capacity_constraints && (
                    <div className="mt-2 pt-2 border-t text-xs text-gray-500">
                      Capacity: {predictiveData.predictions[name].capacity_constraints.daily_capacity} parcels/day
                    </div>
                  )}
                </div>
              )}
              
              {/* Display Scenario Results */}
              {predictiveData.scenarios[name] && (
                <div className="bg-white border border-gray-200 rounded-lg p-3">
                  <h5 className="text-xs font-medium text-gray-700 mb-2">Scenario Analysis Results</h5>
                  <div className="space-y-3 text-xs">
                    {Object.entries(predictiveData.scenarios[name]).map(([scenario, result]) => (
                      <div key={scenario} className="p-3 bg-gray-50 rounded border">
                        <div className="flex items-center justify-between mb-2">
                          <div className="font-medium text-gray-800">{scenario}</div>
                          <div className="flex items-center space-x-2">
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                              result.predicted_change > 0 ? 'bg-green-100 text-green-800' : 
                              result.predicted_change < 0 ? 'bg-red-100 text-red-800' : 
                              'bg-gray-100 text-gray-800'
                            }`}>
                              {result.predicted_change > 0 ? '+' : ''}{result.predicted_change}%
                            </span>
                            <span className="text-gray-600">→ {result.predicted_score}%</span>
                          </div>
                        </div>
                        
                        <div className="text-gray-600 mb-2">{result.impact_description}</div>
                        
                        {result.detailed_effects && result.detailed_effects.length > 0 && (
                          <div className="space-y-1 mb-2">
                            {result.detailed_effects.map((effect, index) => (
                              <div key={index} className="text-gray-500 text-xs">• {effect}</div>
                            ))}
                          </div>
                        )}
                        
                        <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-200">
                          <span className={`px-2 py-1 rounded text-xs ${
                            result.likelihood === 'High' ? 'bg-blue-100 text-blue-700' : 'bg-yellow-100 text-yellow-700'
                          }`}>
                            {result.likelihood} confidence
                          </span>
                          <span className={`text-xs font-medium ${
                            result.recommendation === 'Recommended' ? 'text-green-600' : 'text-orange-600'
                          }`}>
                            {result.recommendation}
                          </span>
                        </div>
                      </div>
                    ))}
                    
                    {predictiveData.scenarios[name].context && (
  <div className="mt-3 p-2 bg-blue-50 rounded border border-blue-200 text-xs">
    <div className="font-medium text-blue-800 mb-1">Performance Context</div>
    <div className="text-blue-700">
      Average: {predictiveData.scenarios[name].context.average_performance}% 
      ({predictiveData.scenarios[name].context.performance_range})
    </div>
  </div>
)}
<ScenarioTranslation
  scenarios={predictiveData.scenarios[name]}
  currentScore={scoreData.overall_score}
  dispatcherName={name}
/>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  </div>
);

const TrackingResultCard = ({ job }) => {
  const [expanded, setExpanded] = useState(false);
  
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4 mb-3 hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center space-x-2">
          <Package className="w-4 h-4 text-blue-600" />
          <span className="font-mono text-sm font-medium text-gray-900">
            {job.doTrackingNumber || job.trackingNumber || 'Unknown'}
          </span>
        </div>
        <button
          onClick={() => setExpanded(!expanded)}
          className="p-1 hover:bg-gray-100 rounded transition-colors"
        >
          {expanded ? <EyeOff className="w-4 h-4 text-gray-500" /> : <Eye className="w-4 h-4 text-gray-500" />}
        </button>
      </div>
      
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(job.currentStatus)}`}>
            {job.currentStatus || 'Unknown'}
          </span>
          <span className="text-xs text-gray-500">
            Job Date: {job.jobDate || 'N/A'}
          </span>
        </div>
        
        {job.receiverName && (
          <div className="flex items-center space-x-1 text-sm text-gray-600">
            <User className="w-3 h-3" />
            <span className="truncate">{job.receiverName}</span>
          </div>
        )}
        
        {job.area && (
          <div className="flex items-center space-x-1 text-sm text-gray-600">
            <MapPin className="w-3 h-3" />
            <span>{job.area}</span>
            {job.receiverPostalCode && (
              <span className="text-gray-400">({job.receiverPostalCode})</span>
            )}
          </div>
        )}
        
        <div className="flex items-center justify-between text-xs text-gray-500">
          <div className="flex items-center space-x-1">
            <Truck className="w-3 h-3" />
            <span>Driver: {job.driver || 'Unassigned'}</span>
          </div>
          <span>Dispatcher: {job.dispatcher || 'Unknown'}</span>
        </div>
      </div>
      
      {expanded && (
        <div className="mt-3 pt-3 border-t space-y-2">
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div>
              <span className="text-gray-500">Tracking #:</span>
              <div className="font-mono text-gray-800">{job.trackingNumber || 'N/A'}</div>
            </div>
            <div>
              <span className="text-gray-500">DO Tracking #:</span>
              <div className="font-mono text-gray-800">{job.doTrackingNumber || 'N/A'}</div>
            </div>
          </div>
          
          {job.receiverAddress && (
            <div>
              <span className="text-gray-500 text-xs">Address:</span>
              <div className="text-sm text-gray-800">{job.receiverAddress}</div>
            </div>
          )}
          
          {job.warehouseEntryDateTime && (
            <div>
              <span className="text-gray-500 text-xs">Warehouse Entry:</span>
              <div className="text-sm text-gray-800">{formatDate(job.warehouseEntryDateTime)}</div>
            </div>
          )}
          
          {job.history && job.history.length > 0 && (
            <div>
              <span className="text-gray-500 text-xs">Recent History:</span>
              <div className="mt-1 space-y-1 max-h-32 overflow-y-auto">
                {job.history.slice(-3).reverse().map((entry, index) => (
                  <div key={index} className="text-xs p-2 bg-gray-50 rounded">
                    <div className="flex justify-between">
                      <span className="font-medium">{entry.statusHistory}</span>
                      <span className="text-gray-500">{formatDate(entry.dateUpdated)}</span>
                    </div>
                    {entry.updatedBy && (
                      <div className="text-gray-600 mt-1">By: {entry.updatedBy}</div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

if (checkingSession) {
  return (
    <div className="h-screen bg-gray-50 flex items-center justify-center">
      <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-600 border-t-transparent"></div>
    </div>
  );
}

if (!user) {
  return <Login />;
}

return (
  <div className="h-screen bg-gray-50 flex flex-col overflow-hidden">
    <Navbar />
    <div className="flex-1 flex overflow-hidden">
      {/* Mobile sidebar toggle */}
      <div className="lg:hidden fixed top-4 left-4 z-30">
        <button
          onClick={() => setSidebarOpen(true)}
          className="p-2 bg-white rounded-lg shadow-md border border-gray-200"
        >
          <Menu className="w-5 h-5 text-gray-600" />
        </button>
      </div>

      {/* Sidebar - Now properly positioned */}
<div 
  className={`fixed lg:relative inset-y-0 left-0 z-20 bg-white border-r border-gray-200 transform ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0 transition-transform duration-300 ease-in-out flex flex-col`}
  style={{
    width: `${sidebarWidth}px`,
    flexShrink: 0
  }}
>
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-800 flex items-center">
            <Search className="w-5 h-5 mr-2 text-blue-600" />
            Tracking Lookup
          </h2>
          <button 
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden p-1 hover:bg-gray-100 rounded"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>
        
        <div className="flex-1 overflow-y-auto p-4">
          {/* Search Forms */}
          <div className="space-y-6">
            {/* Tracking Lookup 1 */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-gray-700">
                  Tracking Number #1
                </label>
                <span className="text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded">Primary</span>
              </div>
              <form onSubmit={(e) => handleTrackingSearch(e, 1)} className="space-y-2">
                <input
                  type="text"
                  value={trackingLookup1.query}
                  onChange={(e) => setTrackingLookup1(prev => ({ ...prev, query: e.target.value }))}
                  placeholder="Enter first tracking number..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                  disabled={!filters.databaseName || !filters.collectionName}
                />
                <button
                  type="submit"
                  disabled={!trackingLookup1.query.trim() || trackingLookup1.loading || !filters.databaseName || !filters.collectionName}
                  style={{
  backgroundColor: '#2563EB',  // bg-blue-600
  color: '#FFFFFF',            // text-white
  padding: '0.5rem 1.5rem',    // py-2 px-6
  borderRadius: '0.5rem',      // rounded-lg
  fontWeight: 500,             // font-medium
  display: 'flex',             // flex
  alignItems: 'center',        // items-center
  gap: '0.5rem',               // space-x-2
  transition: 'background-color 0.2s', // transition-colors
  cursor: 'pointer',           // default cursor
}}
                >
                  {trackingLookup1.loading ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                      <span>Searching...</span>
                    </>
                  ) : (
                    <>
                      <Search className="w-4 h-4" />
                      <span>Search #1</span>
                    </>
                  )}
                </button>
              </form>
            </div>

            {/* Tracking Lookup 2 */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-gray-700">
                  Tracking Number #2
                </label>
                <span className="text-xs text-purple-600 bg-purple-50 px-2 py-1 rounded">Compare</span>
              </div>
              <form onSubmit={(e) => handleTrackingSearch(e, 2)} className="space-y-2">
                <input
                  type="text"
                  value={trackingLookup2.query}
                  onChange={(e) => setTrackingLookup2(prev => ({ ...prev, query: e.target.value }))}
                  placeholder="Enter second tracking number..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm"
                  disabled={!filters.databaseName || !filters.collectionName}
                />
                <button
                  type="submit"
                  disabled={!trackingLookup2.query.trim() || trackingLookup2.loading || !filters.databaseName || !filters.collectionName}
                  style={{
  backgroundColor: '#2563EB',  // bg-blue-600
  color: '#FFFFFF',            // text-white
  padding: '0.5rem 1.5rem',    // py-2 px-6
  borderRadius: '0.5rem',      // rounded-lg
  fontWeight: 500,             // font-medium
  display: 'flex',             // flex
  alignItems: 'center',        // items-center
  gap: '0.5rem',               // space-x-2
  transition: 'background-color 0.2s', // transition-colors
  cursor: 'pointer',           // default cursor
}}
                >
                  {trackingLookup2.loading ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                      <span>Searching...</span>
                    </>
                  ) : (
                    <>
                      <Search className="w-4 h-4" />
                      <span>Search #2</span>
                    </>
                  )}
                </button>
              </form>
            </div>
          </div>

          {/* Search Results */}
          <div className="mt-6 space-y-4">
            {/* Results for Tracking #1 */}
            <div className="border border-blue-200 rounded-lg p-3">
              <div className="flex items-center space-x-2 mb-3">
                <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                <h4 className="text-sm font-medium text-gray-800">Tracking #1 Results</h4>
              </div>
              
              {trackingLookup1.error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-3">
                  <div className="flex items-center space-x-2">
                    <AlertTriangle className="w-4 h-4 text-red-600" />
                    <span className="text-sm font-medium text-red-800">Search Error</span>
                  </div>
                  <p className="text-sm text-red-700 mt-1">{trackingLookup1.error}</p>
                </div>
              )}
              
              {trackingLookup1.lastSearch && trackingLookup1.results.length === 0 && !trackingLookup1.loading && !trackingLookup1.error && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-3">
                  <div className="flex items-center space-x-2">
                    <Package className="w-4 h-4 text-yellow-600" />
                    <span className="text-sm font-medium text-yellow-800">No Results</span>
                  </div>
                  <p className="text-sm text-yellow-700 mt-1">
                    No deliveries found for "{trackingLookup1.lastSearch}"
                  </p>
                </div>
              )}
              
              {trackingLookup1.results.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium text-gray-600">
                      {trackingLookup1.results.length} result(s)
                    </span>
                    <span className="text-xs text-gray-500">
                      "{trackingLookup1.lastSearch}"
                    </span>
                  </div>
                  <div className="space-y-2">
                    {trackingLookup1.results.map((job, index) => (
                      <TrackingResultCard key={job._id || index} job={job} />
                    ))}
                  </div>
                </div>
              )}
              
              {!trackingLookup1.lastSearch && !trackingLookup1.loading && (
                <div className="text-center py-4">
                  <Search className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                  <p className="text-xs text-gray-500">Enter first tracking number</p>
                </div>
              )}
            </div>

            {/* Results for Tracking #2 */}
            <div className="border border-purple-200 rounded-lg p-3">
              <div className="flex items-center space-x-2 mb-3">
                <div className="w-3 h-3 bg-purple-500 rounded-full"></div>
                <h4 className="text-sm font-medium text-gray-800">Tracking #2 Results</h4>
              </div>
              
              {trackingLookup2.error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-3">
                  <div className="flex items-center space-x-2">
                    <AlertTriangle className="w-4 h-4 text-red-600" />
                    <span className="text-sm font-medium text-red-800">Search Error</span>
                  </div>
                  <p className="text-sm text-red-700 mt-1">{trackingLookup2.error}</p>
                </div>
              )}
              
              {trackingLookup2.lastSearch && trackingLookup2.results.length === 0 && !trackingLookup2.loading && !trackingLookup2.error && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-3">
                  <div className="flex items-center space-x-2">
                    <Package className="w-4 h-4 text-yellow-600" />
                    <span className="text-sm font-medium text-yellow-800">No Results</span>
                  </div>
                  <p className="text-sm text-yellow-700 mt-1">
                    No deliveries found for "{trackingLookup2.lastSearch}"
                  </p>
                </div>
              )}
              
              {trackingLookup2.results.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium text-gray-600">
                      {trackingLookup2.results.length} result(s)
                    </span>
                    <span className="text-xs text-gray-500">
                      "{trackingLookup2.lastSearch}"
                    </span>
                  </div>
                  <div className="space-y-2">
                    {trackingLookup2.results.map((job, index) => (
                      <TrackingResultCard key={job._id || index} job={job} />
                    ))}
                  </div>
                </div>
              )}
              
              {!trackingLookup2.lastSearch && !trackingLookup2.loading && (
                <div className="text-center py-4">
                  <Search className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                  <p className="text-xs text-gray-500">Enter second tracking number</p>
                </div>
              )}
            </div>
          </div>

                  {(!filters.databaseName || !filters.collectionName) && (
          <div className="text-center py-4 mt-4">
            <p className="text-xs text-red-500">
              Configure database connection first to enable search.
            </p>
          </div>
        )}
      </div>
      
      {/* Resize Handle */}
      <div 
        className="hidden lg:block absolute right-0 top-0 bottom-0 w-1 bg-transparent hover:bg-blue-400 cursor-col-resize group transition-colors duration-200"
        onMouseDown={handleMouseDown}
      >
        <div className="absolute right-0 top-1/2 transform -translate-y-1/2 w-1 h-12 bg-gray-300 group-hover:bg-blue-400 transition-colors duration-200 rounded-r"></div>
      </div>
    </div>
      
      {/* Main Content */}
<div className="flex-1 flex flex-col h-screen overflow-hidden">
  {/* Header */}
  <div className="bg-white border-b border-gray-200 flex-shrink-0">
    <div className="px-4 sm:px-6 lg:px-8 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <TrendingUp className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">Dispatcher Productivity Dashboard</h1>
                  <p className="text-sm text-gray-500 mt-1">Analyze and optimize delivery performance</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 sm:px-6 lg:px-8 py-4">
          {/* Filters */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 mb-8">
          <div className="flex items-center space-x-2 mb-4">
            <Filter className="w-5 h-5 text-gray-500" />
            <h2 className="text-lg font-semibold text-gray-800">Database Configuration & Analytics</h2>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Database Name</label>
              <input
                type="text"
                value={filters.databaseName}
                onChange={(e) => handleFilterChange('databaseName', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="e.g., delivery_db"
                disabled
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Collection Name</label>
              <input
                type="text"
                value={filters.collectionName}
                onChange={(e) => handleFilterChange('collectionName', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="e.g., jobs"
                disabled
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
              <input
                type="date"
                value={filters.startDate}
                onChange={(e) => handleFilterChange('startDate', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
              <input
                type="date"
                value={filters.endDate}
                onChange={(e) => handleFilterChange('endDate', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          <div className="flex items-center mb-4">
            <input
              type="checkbox"
              id="comparisonPeriod"
              checked={filters.comparisonPeriod}
              onChange={(e) => handleFilterChange('comparisonPeriod', e.target.checked)}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
            />
            <label htmlFor="comparisonPeriod" className="ml-2 block text-sm text-gray-700">
              Compare with previous period
            </label>
          </div>
          
          <div className="flex flex-col sm:flex-row gap-4">
  <button
    onClick={fetchProductivityData}
    disabled={loading || !filters.databaseName || !filters.collectionName}
    style={{
backgroundColor: '#2563EB',  // bg-blue-600
color: '#FFFFFF',            // text-white
padding: '0.5rem 1.5rem',    // py-2 px-6
borderRadius: '0.5rem',      // rounded-lg
fontWeight: 500,             // font-medium
display: 'flex',             // flex
alignItems: 'center',        // items-center
gap: '0.5rem',               // space-x-2
transition: 'background-color 0.2s', // transition-colors
cursor: 'pointer',           // default cursor
}}
      >
    {loading ? (
      <>
        <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2"></div>
        <span>Calculating...</span>
      </>
    ) : (
      <>
        <Search className="w-4 h-4 mr-2" />
        <span>Analyze Productivity</span>
      </>
    )}
  </button>
  
  <button
    onClick={buildPredictionModels}
    disabled={buildingModels || !filters.databaseName || !filters.collectionName || !analysisCompleted}
    style={{
backgroundColor: (!analysisCompleted || buildingModels || !filters.databaseName || !filters.collectionName) ? '#9CA3AF' : '#2563EB',  // gray when disabled, blue when enabled
color: '#FFFFFF',            // text-white
padding: '0.5rem 1.5rem',    // py-2 px-6
borderRadius: '0.5rem',      // rounded-lg
fontWeight: 500,             // font-medium
display: 'flex',             // flex
alignItems: 'center',        // items-center
gap: '0.5rem',               // space-x-2
transition: 'background-color 0.2s', // transition-colors
cursor: (!analysisCompleted || buildingModels || !filters.databaseName || !filters.collectionName) ? 'not-allowed' : 'pointer',
opacity: (!analysisCompleted || buildingModels || !filters.databaseName || !filters.collectionName) ? 0.6 : 1
}}
      >
    {buildingModels ? (
      <>
        <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2"></div>
        <span>Building Models...</span>
      </>
    ) : (
      <>
        <BarChart3 className="w-4 h-4 mr-2" />
        <span>Build Prediction Models</span>
      </>
    )}
  </button>
</div>
          
          <div className="mt-4 bg-blue-50 p-4 rounded-lg">
            <h3 className="text-sm font-medium text-blue-800 mb-2">Predictive Analytics Method</h3>
            <ul className="text-xs text-blue-700 space-y-1">
              <li>• Uses past 12 months of data</li>
              <li>• Completed deliveries for training</li>
              <li>• ARIMA models for time series forecasting</li>
              <li>• Assumes fixed seasonality patterns</li>
            </ul>
          </div>
        </div>

          {/* Error Display */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
              <div className="flex items-center space-x-2">
                <AlertTriangle className="w-5 h-5 text-red-600" />
                <p className="text-red-800 font-medium">Error</p>
              </div>
              <p className="text-red-700 mt-1">{error}</p>
            </div>
          )}

          {/* Comparison Period Info */}
          {comparisonData && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
              <div className="flex items-center space-x-2">
                <Calendar className="w-5 h-5 text-blue-600" />
                <p className="text-blue-800 font-medium">Comparison Period</p>
              </div>
              <p className="text-blue-700 mt-1">
                Comparing {comparisonData.comparison_start_date} to {comparisonData.comparison_end_date} with current period
              </p>
            </div>
          )}

          {/* Summary Cards */}
          {data.summary && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-6 mb-8">
              <MetricCard
                title="Total Jobs"
                value={data.summary.total_jobs}
                subtitle={data.summary.date_range}
                icon={Package}
                color="blue"
                comparisonValue={comparisonData?.summary?.total_jobs}
              />
              <MetricCard
                title="In Warehouse"
                value={data.summary.in_warehouse || 0}
                subtitle="Parcels currently at warehouse"
                icon={PackageCheck}
                color="yellow"
                comparisonValue={comparisonData?.summary?.in_warehouse}
              />
              <MetricCard
                title="Warehouse Receipts"
                value={data.summary.warehouse_receipts || 0}
                subtitle="Parcels received in warehouse"
                icon={Warehouse}
                color="orange"
                comparisonValue={comparisonData?.summary?.warehouse_receipts}
              />
              <MetricCard
                title="Date Range"
                value={`${Math.round((new Date(filters.endDate) - new Date(filters.startDate)) / (1000 * 60 * 60 * 24)) + 1} days`}
                subtitle="Analysis period"
                icon={Calendar}
                color="green"
              />
              <MetricCard
                title="Active Dispatchers"
                value={Object.keys(data.data || {}).length}
                subtitle="Dispatchers analyzed"
                icon={Users}
                color="purple"
                comparisonValue={comparisonData ? Object.keys(comparisonData.data || {}).length : undefined}
              />
              <MetricCard
                title="Database"
                value={data.summary.database || 'N/A'}
                subtitle={data.summary.collection || 'N/A'}
                icon={Database}
                color="indigo"
              />
              <MetricCard
  title="ML Models Built"
  value={Object.keys(predictiveData.models).filter(name => !predictiveData.models[name].error).length}
  subtitle="Trained prediction models"
  icon={TrendingUp}
  color="purple"
/>
            </div>
          )}

          {data.summary && (
  <div className="mb-8">
    <div className="flex items-center justify-between mb-4">
      <h2 className="text-lg font-semibold text-gray-800">Company Performance Analytics</h2>
      <button
        onClick={generateCompanyChart}
        style={{
  backgroundColor: '#2563EB',  // bg-blue-600
  color: '#FFFFFF',            // text-white
  padding: '0.5rem 1.5rem',    // py-2 px-6
  borderRadius: '0.5rem',      // rounded-lg
  fontWeight: 500,             // font-medium
  display: 'flex',             // flex
  alignItems: 'center',        // items-center
  gap: '0.5rem',               // space-x-2
  transition: 'background-color 0.2s', // transition-colors
  cursor: 'pointer',           // default cursor
}}
                
      >
        <BarChart3 className="w-4 h-4" />
        <span>Generate Company Chart</span>
      </button>
    </div>
    {chartData.company && <CompanyChart data={chartData.company} />}
  </div>
)}

          {/* Export Report */}
          {data.data && Object.keys(data.data).length > 0 && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 mb-8">
              <h3 className="text-lg font-semibold text-gray-800 flex items-center mb-4">
                <FileDown className="w-5 h-5 mr-2 text-blue-600" />
                Export Report
              </h3>

              <div className="flex items-center space-x-6 mb-4">
                <label className="flex items-center space-x-2 text-sm text-gray-700 cursor-pointer">
                  <input
                    type="radio"
                    checked={exportSelection.mode === 'all'}
                    onChange={() => setExportSelection(prev => ({ ...prev, mode: 'all' }))}
                  />
                  <span>All Dispatchers ({Object.keys(data.data).filter(n => n !== 'N/A').length})</span>
                </label>
                <label className="flex items-center space-x-2 text-sm text-gray-700 cursor-pointer">
                  <input
                    type="radio"
                    checked={exportSelection.mode === 'selected'}
                    onChange={() => setExportSelection(prev => ({ ...prev, mode: 'selected' }))}
                  />
                  <span>Select Dispatchers</span>
                </label>
              </div>

              {exportSelection.mode === 'selected' && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-4 p-3 bg-gray-50 rounded-lg max-h-48 overflow-y-auto">
                  {Object.keys(data.data).filter(n => n !== 'N/A').sort().map(name => (
                    <label key={name} className="flex items-center space-x-2 text-sm text-gray-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={exportSelection.selected.includes(name)}
                        onChange={() => toggleExportDispatcher(name)}
                      />
                      <span>{name}</span>
                    </label>
                  ))}
                </div>
              )}

              <button
                onClick={handleExportReport}
                disabled={exporting || (exportSelection.mode === 'selected' && exportSelection.selected.length === 0)}
                className="flex items-center space-x-2 bg-blue-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                <FileDown className="w-4 h-4" />
                <span>{exporting ? 'Generating PDF...' : 'Export PDF Report'}</span>
              </button>
            </div>
          )}

          {/* Productivity Cards */}
          {data.data && Object.keys(data.data).length > 0 && (
            <div>
              <div className="flex items-center space-x-2 mb-6">
                <BarChart3 className="w-5 h-5 text-gray-500" />
                <h2 className="text-lg font-semibold text-gray-800">Dispatcher Productivity Scores</h2>
                <div className="ml-auto text-sm text-gray-500">
                  Sorted by overall score
                </div>
              </div>
              
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
{Object.entries(data.data)
  .sort(([,a], [,b]) => b.overall_score - a.overall_score)
  .map(([name, scoreData]) => (
    <ProductivityCard 
      key={name} 
      name={name} 
      scoreData={scoreData} 
      comparisonData={comparisonData?.data?.[name]}
    />
  ))}
              </div>

              {expandedDispatchers[name] && predictiveData.models[name] && (
  <div className="space-y-4 pt-4 border-t">
    <h4 className="text-sm font-medium text-gray-700 mb-2 flex items-center">
      <TrendingUp className="w-4 h-4 mr-2 text-purple-600" />
      Predictive Analysis
    </h4>
    
    {/* Model Status */}
    <div className="bg-purple-50 p-3 rounded-lg">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium text-purple-800">Model Status</span>
        {predictiveData.models[name].error ? (
          <span className="text-xs bg-red-100 text-red-800 px-2 py-1 rounded-full">
            Error
          </span>
        ) : (
          <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded-full">
            Trained
          </span>
        )}
      </div>
      
      {predictiveData.models[name].error ? (
        <p className="text-xs text-red-700">{predictiveData.models[name].error}</p>
      ) : (
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div>
            <span className="text-purple-600">Training Periods:</span>
            <span className="ml-1 font-medium">{predictiveData.models[name].training_periods}</span>
          </div>
          <div>
            <span className="text-purple-600">Accuracy (R²):</span>
            <span className="ml-1 font-medium">{predictiveData.models[name].r2_score}</span>
          </div>
        </div>
      )}
    </div>
    
    {/* Prediction Actions */}
    <div className="flex space-x-2">
      <button
        onClick={() => predictPerformance(name)}
        className="flex-1 px-3 py-2 bg-purple-600 text-white text-xs rounded-md hover:bg-purple-700"
      >
        Predict Next 3 Months
      </button>
      <button
        onClick={() => getPerformanceDrivers(name)}
        className="flex-1 px-3 py-2 bg-blue-600 text-white text-xs rounded-md hover:bg-blue-700"
      >
        Analyze Drivers
      </button>
    </div>
    
    {/* Display Predictions */}
    {predictiveData.predictions[name] && (
      <div className="bg-white border border-gray-200 rounded-lg p-3">
        <h5 className="text-xs font-medium text-gray-700 mb-2">Performance Predictions</h5>
        <div className="space-y-2">
          {predictiveData.predictions[name].predictions.map((prediction, index) => (
            <div key={index} className="flex justify-between items-center text-xs">
              <span className="text-gray-600">Month {prediction.month}:</span>
              <span className="font-medium text-gray-800">
                {prediction.predicted_score}%
                <span className="text-gray-400 ml-1">
                  ({prediction.confidence_lower}-{prediction.confidence_upper})
                </span>
              </span>
            </div>
          ))}
        </div>
      </div>
    )}
    
    {/* Display Performance Drivers */}
    {predictiveData.drivers && predictiveData.drivers[name] && (
      <div className="bg-white border border-gray-200 rounded-lg p-3">
        <h5 className="text-xs font-medium text-gray-700 mb-2">Key Performance Drivers</h5>
        <div className="space-y-2">
          <div>
            <span className="text-xs font-medium text-green-600">Top Positive Factors:</span>
            <ul className="text-xs text-gray-700 mt-1">
              {predictiveData.drivers[name].top_positive_factors.slice(0, 3).map((factor, index) => (
                <li key={index} className="flex justify-between">
                  <span>{factor.feature}:</span>
                  <span className="font-medium">+{factor.impact.toFixed(3)}</span>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <span className="text-xs font-medium text-red-600">Top Negative Factors:</span>
            <ul className="text-xs text-gray-700 mt-1">
              {predictiveData.drivers[name].top_negative_factors.slice(0, 3).map((factor, index) => (
                <li key={index} className="flex justify-between">
                  <span>{factor.feature}:</span>
                  <span className="font-medium">{factor.impact.toFixed(3)}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    )}
  </div>
)}

          {/* Advanced Predictive Analysis Section */}
{predictiveData.models && Object.keys(predictiveData.models).length > 0 && (
  <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 mt-8">
    <div className="flex items-center space-x-2 mb-6">
      <TrendingUp className="w-5 h-5 text-purple-600" />
      <h2 className="text-lg font-semibold text-gray-800">Advanced Predictive Analysis</h2>
    </div>

    {/* Custom ARIMA Predictions Section */}
<div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 mb-8">
  <div className="flex items-center space-x-2 mb-4">
    <TrendingUp className="w-5 h-5 text-purple-600" />
    <h2 className="text-lg font-semibold text-gray-800">Custom ARIMA Predictions</h2>
  </div>

  {/* Only show this section if models are built */}
  {predictiveData.models && Object.keys(predictiveData.models).length > 0 ? (
    <div className="space-y-6">
      {/* Input Form */}
      <div className="bg-purple-50 p-6 rounded-lg">
        <h3 className="text-md font-semibold text-purple-800 mb-4">Configure Custom Prediction</h3>
        
<div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
  {/* Dispatcher Selection */}
  <div>
    <label className="block text-sm font-medium text-gray-700 mb-2">
      Select Dispatcher *
    </label>
    <select 
      value={selectedDispatcher} 
      onChange={(e) => setSelectedDispatcher(e.target.value)}
      className="w-full p-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
    >
      <option value="">Choose dispatcher...</option>
      {Object.entries(predictiveData.models)
        .filter(([, model]) => !model.error)
        .map(([dispatcherName]) => (
          <option key={dispatcherName} value={dispatcherName}>{dispatcherName}</option>
        ))
      }
    </select>
  </div>
  
  {/* Months to Predict */}
  <div>
    <label className="block text-sm font-medium text-gray-700 mb-2">
      Prediction Timeframe (Months) *
    </label>
    <input
      type="number"
      min="1"
      max="12"
      value={customPrediction.monthsAhead}
      onChange={(e) => setCustomPrediction(prev => ({
        ...prev, 
        monthsAhead: parseInt(e.target.value) || 1
      }))}
      className="w-full p-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
      placeholder="e.g., 3"
    />
    <p className="text-xs text-gray-500 mt-1">1-12 months ahead</p>
  </div>
  
  {/* Target Parcels */}
  <div>
    <label className="block text-sm font-medium text-gray-700 mb-2">
      Target Parcels per Month
    </label>
    <input
      type="number"
      min="0"
      step="100"
      value={customPrediction.targetParcels}
      onChange={(e) => setCustomPrediction(prev => ({
        ...prev, 
        targetParcels: e.target.value ? parseInt(e.target.value) : ''
      }))}
      className="w-full p-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
      placeholder="e.g., 2500"
    />
    <p className="text-xs text-gray-500 mt-1">Monthly target volume</p>
  </div>
  
  {/* NEW: Daily Capacity Input */}
  <div>
    <label className="block text-sm font-medium text-gray-700 mb-2">
      Daily Capacity (Parcels)
    </label>
    <input
      type="number"
      min="1"
      step="10"
      value={customPrediction.dailyCapacity}
      onChange={(e) => setCustomPrediction(prev => ({
        ...prev, 
        dailyCapacity: e.target.value ? parseInt(e.target.value) : ''
      }))}
      className="w-full p-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
      placeholder="e.g., 130"
    />
    <p className="text-xs text-gray-500 mt-1">Parcels per day</p>
  </div>
</div>
        
        {/* Action Buttons */}
        <div className="flex space-x-3">
          <button
            onClick={runCustomPrediction}
            disabled={!selectedDispatcher || customPrediction.loading}
            style={{
  backgroundColor: '#2563EB',  // bg-blue-600
  color: '#FFFFFF',            // text-white
  padding: '0.5rem 1.5rem',    // py-2 px-6
  borderRadius: '0.5rem',      // rounded-lg
  fontWeight: 500,             // font-medium
  display: 'flex',             // flex
  alignItems: 'center',        // items-center
  gap: '0.5rem',               // space-x-2
  transition: 'background-color 0.2s', // transition-colors
  cursor: 'pointer',           // default cursor
}}
                
          >
            {customPrediction.loading ? (
              <>
                <div className="inline-block animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2"></div>
                Predicting...
              </>
            ) : (
              'Generate Custom Prediction'
            )}
          </button>
          
        </div>
      </div>

      {/* Display Current Settings */}
      <div className="bg-gray-50 p-4 rounded-lg">
  <h4 className="text-sm font-medium text-gray-700 mb-2">Current Settings:</h4>
  <div className="flex flex-wrap gap-4 text-sm text-gray-600">
    <span>Dispatcher: <strong>{selectedDispatcher || 'None selected'}</strong></span>
    <span>Timeframe: <strong>{customPrediction.monthsAhead} months</strong></span>
    <span>Target Volume: <strong>{customPrediction.targetParcels || 'No limit'} parcels/month</strong></span>
    <span>Daily Capacity: <strong>{customPrediction.dailyCapacity || 'Default (130)'} parcels/day</strong></span>
  </div>
</div>

      {/* Results Display */}
      {customPrediction.results && (
        <div className="bg-white border-2 border-purple-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-purple-800 mb-4">
            Prediction Results for {customPrediction.results.dispatcher}
          </h3>
          
          {customPrediction.dailyCapacity && (
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-4">
        <div className="flex items-center">
          <AlertTriangle className="w-5 h-5 text-yellow-600 mr-2" />
          <span className="text-yellow-800 font-medium">Custom Capacity Applied:</span>
          <span className="ml-2">{customPrediction.dailyCapacity} parcels/day</span>
        </div>
      </div>
    )}
    
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Monthly Predictions */}
      <div>
        <h4 className="text-md font-medium text-gray-700 mb-3">Monthly Predictions</h4>
        <div className="space-y-3">
          {customPrediction.results.predictions?.map((pred, index) => (
            <div key={index} className="bg-purple-50 p-4 rounded-lg">
              <div className="flex justify-between items-center">
                <span className="font-medium text-gray-800">Month {pred.month}</span>
                <span className="text-lg font-bold text-purple-600">{pred.predicted_score}%</span>
              </div>
              <div className="text-sm text-gray-600 mt-1">
                Confidence: {pred.confidence_lower}% - {pred.confidence_upper}%
              </div>
              {pred.capacity_utilization && (
                <div className="text-sm text-purple-700 mt-1">
                  Capacity Load: {pred.capacity_utilization}%
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
      
      {/* Capacity Analysis */}
      <div>
        <h4 className="text-md font-medium text-gray-700 mb-3">Capacity Analysis</h4>
        <div className="space-y-3">
          <div className="bg-gray-50 p-4 rounded-lg">
            <div className="text-sm text-gray-600">Daily Capacity</div>
            <div className="text-xl font-bold text-gray-800">
              {customPrediction.results.capacity_constraints?.daily_capacity || 130} parcels
            </div>
            {customPrediction.dailyCapacity && (
              <div className="text-xs text-green-600 mt-1">(Custom value applied)</div>
            )}
          </div>
          <div className="bg-gray-50 p-4 rounded-lg">
            <div className="text-sm text-gray-600">Monthly Capacity</div>
            <div className="text-xl font-bold text-gray-800">
              {customPrediction.results.capacity_constraints?.monthly_capacity || 2860} parcels
            </div>
          </div>
          <div className="bg-gray-50 p-4 rounded-lg">
            <div className="text-sm text-gray-600">Model Type</div>
            <div className="text-lg font-medium text-gray-800">
              {customPrediction.results.model_type || 'ARIMA'}
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
)}

      {/* Bulk Results */}
      {bulkPrediction.results && Object.keys(bulkPrediction.results).length > 0 && (
        <div className="bg-white border-2 border-blue-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-blue-800 mb-4">
            Bulk Prediction Results ({Object.keys(bulkPrediction.results).length} Dispatchers)
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Object.entries(bulkPrediction.results).map(([dispatcher, result]) => (
              <div key={dispatcher} className="bg-blue-50 p-4 rounded-lg">
                <h4 className="font-medium text-gray-800 mb-2">{dispatcher}</h4>
                {result.error ? (
                  <div className="text-red-600 text-sm">{result.error}</div>
                ) : (
                  <div className="space-y-2">
                    {result.predictions?.slice(0, 3).map((pred, index) => (
                      <div key={index} className="flex justify-between text-sm">
                        <span>Month {pred.month}:</span>
                        <span className="font-medium">{pred.predicted_score}%</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  ) : (
    <div className="text-center py-8">
      <TrendingUp className="w-16 h-16 text-gray-300 mx-auto mb-4" />
      <h3 className="text-lg font-medium text-gray-500 mb-2">No Prediction Models Available</h3>
      <p className="text-gray-400 mb-4">Build ARIMA models first to access custom predictions</p>
      <button
  onClick={buildPredictionModels}
  disabled={buildingModels || !filters.databaseName || !filters.collectionName || !analysisCompleted}
  style={{
    backgroundColor: '#2563EB',
    color: '#FFFFFF',
    padding: '0.5rem 1.5rem',
    borderRadius: '0.5rem',
    fontWeight: 500,
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    transition: 'background-color 0.2s',
    cursor: (!analysisCompleted || buildingModels || !filters.databaseName || !filters.collectionName) ? 'not-allowed' : 'pointer',
  opacity: (!analysisCompleted || buildingModels || !filters.databaseName || !filters.collectionName) ? 0.6 : 1
  }}
>
  {buildingModels ? (
    <>
      <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2"></div>
      <span>Building Models...</span>
    </>
  ) : (
    <>
      <BarChart3 className="w-4 h-4 mr-2" />
      <span>Build Prediction Models</span>
    </>
  )}
</button>
    </div>
  )}
</div>
    
    
<div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 mb-8">
  <div className="flex items-center space-x-2 mb-4">
    <Users className="w-5 h-5 text-blue-600" />
    <h2 className="text-lg font-semibold text-gray-800">Company Capacity Planning</h2>
  </div>

  <div className="bg-blue-50 p-6 rounded-lg mb-4">
    <h3 className="text-md font-semibold text-blue-800 mb-4">Calculate Required Drivers</h3>
    
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
  {/* Monthly Parcels Input */}
  <div>
    <label className="block text-sm font-medium text-gray-700 mb-2">
      Monthly Parcel Volume *
    </label>
    <input
      type="number"
      min="1"
      step="100"
      value={companyPrediction.monthlyParcels}
      onChange={(e) => setCompanyPrediction(prev => ({
        ...prev, 
        monthlyParcels: e.target.value ? parseInt(e.target.value) : ''
      }))}
      className="w-full p-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
      placeholder="e.g., 5000"
    />
    <p className="text-xs text-gray-500 mt-1">Total parcels to deliver this month</p>
  </div>
  
  {/* Daily Capacity Input */}
  <div>
    <label className="block text-sm font-medium text-gray-700 mb-2">
      Daily Capacity per Driver
    </label>
    <input
      type="number"
      min="1"
      step="10"
      value={companyPrediction.dailyCapacity}
      onChange={(e) => setCompanyPrediction(prev => ({
        ...prev, 
        dailyCapacity: e.target.value ? parseInt(e.target.value) : 130
      }))}
      className="w-full p-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
      placeholder="e.g., 130"
    />
    <p className="text-xs text-gray-500 mt-1">Parcels per driver per day</p>
  </div>
  <div className="flex items-center justify-between mb-4 p-3 bg-gray-50 rounded-lg">
  <div>
    <span className="text-sm font-medium text-gray-700">Driver Count Source</span>
    <p className="text-xs text-gray-500">Choose how to count current active drivers</p>
  </div>
  <div className="flex items-center space-x-3">
    <label className="flex items-center">
      <input
        type="radio"
        name="driverCountSource"
        checked={!useManualDriverCount}
        onChange={() => setUseManualDriverCount(false)}
        className="mr-2"
      />
      <span className="text-sm">From Analysis Data ({Object.keys(data.data || {}).length})</span>
    </label>
    <label className="flex items-center">
      <input
        type="radio"
        name="driverCountSource"
        checked={useManualDriverCount}
        onChange={() => setUseManualDriverCount(true)}
        className="mr-2"
      />
      <span className="text-sm">Manual Input</span>
    </label>
  </div>
</div>

  {/* NEW: Manual Current Drivers Input */}
  {useManualDriverCount ? (
  /* Manual Current Drivers Input */
  <div>
    <label className="block text-sm font-medium text-gray-700 mb-2">
      Current Active Drivers *
    </label>
    <input
      type="number"
      min="1"
      step="1"
      value={companyPrediction.currentDrivers}
      onChange={(e) => setCompanyPrediction(prev => ({
        ...prev, 
        currentDrivers: e.target.value ? parseInt(e.target.value) : ''
      }))}
      className="w-full p-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
      placeholder="e.g., 8"
    />
    <p className="text-xs text-gray-500 mt-1">Number of active drivers</p>
  </div>
) : (
  /* Analysis Data Display */
  <div>
    <label className="block text-sm font-medium text-gray-700 mb-2">
      From Analysis Data
    </label>
    <div className="w-full p-3 bg-gray-100 rounded-md text-gray-800">
      {Object.keys(data.data || {}).length} drivers detected
    </div>
    <p className="text-xs text-gray-500 mt-1">Based on current analysis</p>
  </div>
)}
</div>
    
    {/* Action Button */}
    <button
      onClick={predictCompanyCapacity}
      disabled={companyPrediction.loading || !companyPrediction.monthlyParcels}
      style={{
  backgroundColor: '#2563EB',  // bg-blue-600
  color: '#FFFFFF',            // text-white
  padding: '0.5rem 1.5rem',    // py-2 px-6
  borderRadius: '0.5rem',      // rounded-lg
  fontWeight: 500,             // font-medium
  display: 'flex',             // flex
  alignItems: 'center',        // items-center
  gap: '0.5rem',               // space-x-2
  transition: 'background-color 0.2s', // transition-colors
  cursor: 'pointer',           // default cursor
}}
                
          
    >
      {companyPrediction.loading ? (
        <>
          <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
          <span>Calculating...</span>
        </>
      ) : (
        <>
          <Calculator className="w-4 h-4" />
          <span>Calculate Capacity Needs</span>
        </>
      )}
    </button>
  </div>

  {/* Results Display */}
  {companyPrediction.results && (
  <div className="bg-white border-2 border-blue-200 rounded-lg p-6">
    <h3 className="text-lg font-semibold text-blue-800 mb-4">
      Enhanced Capacity Planning Results
    </h3>
    
    {/* Risk Alerts */}
    {companyPrediction.results.riskFactors.length > 0 && (
      <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
        <div className="flex items-center space-x-2 mb-2">
          <AlertTriangle className="w-5 h-5 text-red-600" />
          <span className="font-medium text-red-800">Risk Factors Identified</span>
        </div>
        <ul className="text-sm text-red-700 list-disc list-inside">
          {companyPrediction.results.riskFactors.map((risk, index) => (
            <li key={index}>{risk}</li>
          ))}
        </ul>
      </div>
    )}
    
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-4">
      {/* Key Metrics */}
      <div className="space-y-4">
        <div className="bg-blue-50 p-4 rounded-lg">
          <div className="text-sm text-blue-600 mb-1">Required Drivers</div>
          <div className="text-2xl font-bold text-blue-800">
            {companyPrediction.results.requiredDrivers}
          </div>
          <div className="text-xs text-blue-600 mt-1">
            For {companyPrediction.results.adjustedMonthlyTarget} parcels/month (seasonal adjusted)
          </div>
        </div>
        
        <div className="bg-green-50 p-4 rounded-lg">
          <div className="text-sm text-green-600 mb-1">Current Team</div>
          <div className="text-2xl font-bold text-green-800">
            {companyPrediction.results.currentDrivers}
          </div>
          <div className="text-xs text-green-600 mt-1">
            Avg Score: {companyPrediction.results.avgPerformanceScore}%
          </div>
        </div>
        
        <div className={`p-4 rounded-lg ${
          companyPrediction.results.additionalDriversNeeded > 0 
            ? 'bg-orange-50' 
            : 'bg-green-50'
        }`}>
          <div className="text-sm mb-1">Additional Drivers Needed</div>
          <div className={`text-2xl font-bold ${
            companyPrediction.results.additionalDriversNeeded > 0 
              ? 'text-orange-800' 
              : 'text-green-800'
          }`}>
            {companyPrediction.results.additionalDriversNeeded}
          </div>
          {companyPrediction.results.additionalMonthlyCost > 0 && (
            <div className="text-xs text-orange-600 mt-1">
              Est. cost: ${companyPrediction.results.additionalMonthlyCost}/month
            </div>
          )}
        </div>
      </div>
      
      {/* Performance & Utilization */}
      <div className="space-y-4">
        <div className="bg-gray-50 p-4 rounded-lg">
          <div className="text-sm text-gray-600 mb-1">Capacity Utilization</div>
          <div className="text-2xl font-bold text-gray-800">
            {companyPrediction.results.utilizationPercentage}%
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
            <div 
              className={`h-2 rounded-full ${
                companyPrediction.results.utilizationPercentage <= 85 ? 'bg-green-500' :
                companyPrediction.results.utilizationPercentage <= 100 ? 'bg-yellow-500' :
                'bg-red-500'
              }`}
              style={{ width: `${Math.min(100, companyPrediction.results.utilizationPercentage)}%` }}
            ></div>
          </div>
        </div>
        
        <div className="bg-purple-50 p-4 rounded-lg">
          <div className="text-sm text-purple-600 mb-1">Confidence Score</div>
          <div className={`text-xl font-bold ${companyPrediction.results.confidenceColor}`}>
            {companyPrediction.results.confidenceLevel}
          </div>
          <div className="text-xs text-purple-600 mt-1">
            {companyPrediction.results.confidenceScore}/100
          </div>
        </div>
        
        <div className="bg-indigo-50 p-4 rounded-lg">
          <div className="text-sm text-indigo-600 mb-1">Performance Factor</div>
          <div className="text-xl font-bold text-indigo-800">
            {companyPrediction.results.performanceMultiplier}x
          </div>
          <div className="text-xs text-indigo-600 mt-1">
            Efficiency multiplier based on team performance
          </div>
        </div>
      </div>
      
      {/* Timeline & Implementation */}
      <div className="space-y-4">
        <div className="bg-yellow-50 p-4 rounded-lg">
          <div className="text-sm text-yellow-600 mb-1">Implementation Timeline</div>
          <div className="text-sm font-medium text-yellow-800">
            {companyPrediction.results.implementationTimeline}
          </div>
        </div>
        
        <div className="bg-red-50 p-4 rounded-lg">
          <div className="text-sm text-red-600 mb-1">Capacity Deficit</div>
          <div className="text-xl font-bold text-red-800">
            {companyPrediction.results.projectedDeficit}
          </div>
          <div className="text-xs text-red-600 mt-1">parcels/month shortfall</div>
        </div>
        
        <div className="bg-teal-50 p-4 rounded-lg">
          <div className="text-sm text-teal-600 mb-1">Adjusted Capacity</div>
          <div className="text-lg font-bold text-teal-800">
            {companyPrediction.results.adjustedDailyCapacity}
          </div>
          <div className="text-xs text-teal-600 mt-1">parcels/driver/day (performance-adjusted)</div>
        </div>
      </div>
    </div>
    
    {/* Enhanced Detailed Breakdown */}
    <div className="bg-gray-50 p-4 rounded-lg mb-4">
      <h4 className="text-sm font-medium text-gray-700 mb-3">Enhanced Calculation Details</h4>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
        <div>
          <span className="text-gray-600">Effective working days:</span>
          <span className="ml-2 font-medium">{companyPrediction.results.effectiveWorkingDays}</span>
        </div>
        <div>
          <span className="text-gray-600">Performance-adjusted capacity:</span>
          <span className="ml-2 font-medium">{companyPrediction.results.parcelsPerDriverPerMonth}/driver/month</span>
        </div>
        <div>
          <span className="text-gray-600">Team average throughput:</span>
          <span className="ml-2 font-medium">{companyPrediction.results.avgThroughput}/day</span>
        </div>
        <div>
          <span className="text-gray-600">Seasonal adjustment factor:</span>
          <span className="ml-2 font-medium">{companyPrediction.results.seasonalFactor}x</span>
        </div>
        <div>
          <span className="text-gray-600">Current total capacity:</span>
          <span className="ml-2 font-medium">{companyPrediction.results.currentCapacity} parcels/month</span>
        </div>
        <div>
          <span className="text-gray-600">Target (seasonal-adjusted):</span>
          <span className="ml-2 font-medium">{companyPrediction.results.adjustedMonthlyTarget} parcels/month</span>
        </div>
      </div>
    </div>
    
    {/* Smart Recommendations */}
    <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
      <h4 className="text-sm font-medium text-blue-800 mb-2">AI-Powered Recommendations</h4>
      <ul className="text-sm text-blue-700 space-y-1">
        {companyPrediction.results.additionalDriversNeeded === 0 ? (
          <>
            <li>✓ Current capacity is sufficient for target volume</li>
            <li>• Focus on maintaining {companyPrediction.results.avgPerformanceScore}% team performance</li>
            <li>• Consider cross-training for operational flexibility</li>
            <li>• Monitor for seasonal fluctuations</li>
          </>
        ) : (
          <>
            <li>• Prioritize hiring {Math.min(2, companyPrediction.results.additionalDriversNeeded)} drivers immediately</li>
            {companyPrediction.results.additionalDriversNeeded > 2 && (
              <li>• Implement phased hiring to maintain team integration quality</li>
            )}
            <li>• Estimated timeline: {companyPrediction.results.implementationTimeline}</li>
            <li>• Budget approximately ${companyPrediction.results.additionalMonthlyCost}/month for additional drivers</li>
          </>
        )}
        
        {companyPrediction.results.avgPerformanceScore < 80 && (
          <li>⚠ Consider performance improvement training before scaling</li>
        )}
        
        {companyPrediction.results.utilizationPercentage > 90 && (
          <li>⚠ High utilization detected - monitor driver wellness and burnout</li>
        )}
        
        {companyPrediction.results.performanceMultiplier < 0.9 && (
          <li>📊 Low performance multiplier suggests operational improvement opportunities</li>
        )}
      </ul>
    </div>
  </div>
)}
</div>
  </div>
)}
              
              {/* Detailed Metrics Table */}
              <div className="mt-8 bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-200">
                  <h3 className="text-lg font-semibold text-gray-800 flex items-center space-x-2">
                    <Activity className="w-5 h-5 text-gray-500" />
                    <span>Detailed Metrics</span>
                  </h3>
                </div>
                
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Dispatcher
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Overall Score
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Delivery Success
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          On-Time Rate
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Throughput/Day
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Completion Gaps
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Route Score
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Departure Time
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          End Time
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Total Jobs
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {Object.entries(data.data)
                        .sort(([,a], [,b]) => b.overall_score - a.overall_score)
                        .map(([name, scoreData]) => (
                          <tr key={name} className="hover:bg-gray-50 transition-colors">
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="text-sm font-medium text-gray-900">{name}</div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getScoreBadgeColor(scoreData.overall_score)}`}>
                                {scoreData.overall_score}%
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              {scoreData.metrics.delivery_success_rate}%
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              {scoreData.metrics.on_time_rate}%
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              {scoreData.metrics.throughput_per_day}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              {scoreData.completion_gaps ? (
                                <div className="text-xs">
                                  {scoreData.completion_gaps.total_gaps === 0 ? (
                                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                      <Clock className="w-3 h-3 mr-1" />
                                      None
                                    </span>
                                  ) : (
                                    <div>
                                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                                        scoreData.completion_gaps.total_gaps > 3 ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800'
                                      }`}>
                                        <AlertTriangle className="w-3 h-3 mr-1" />
                                        {scoreData.completion_gaps.total_gaps} gaps
                                      </span>
                                      <div className="text-gray-500 mt-1">
                                        Avg: {scoreData.completion_gaps.avg_gap_minutes}min
                                      </div>
                                      <div className="text-gray-500">
                                        Max: {scoreData.completion_gaps.max_gap_minutes}min
                                      </div>
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <span className="text-gray-400 text-xs">N/A</span>
                              )}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              {scoreData.metrics.route_difficulty_score}%
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              {scoreData.schedule?.avg_start_time || 'N/A'}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              {scoreData.schedule?.avg_end_time || 'N/A'}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {scoreData.total_jobs} ({scoreData.completed_jobs} completed)
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </div>
              
              {/* Scoring Methodology */}
              <div className="mt-8 bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                <div className="flex items-center space-x-2 mb-4">
                  <Settings className="w-5 h-5 text-gray-500" />
                  <h3 className="text-lg font-semibold text-gray-800">Scoring Methodology</h3>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
      <div className="p-4 bg-blue-50 rounded-lg">
        <div className="font-medium text-blue-800 mb-2">Delivery Success (40%)</div>
        <p className="text-blue-700">
          Completed deliveries ÷ Total assigned jobs. 
          Uses Wilson Score method to account for sample size variations.
        </p>
      </div>
                          
                  <div className="p-4 bg-green-50 rounded-lg">
        <div className="font-medium text-green-800 mb-2">On-Time Rate (15%)</div>
        <p className="text-green-700">
          Deliveries completed within 3 days of warehouse entry.
        </p>
      </div>
                  
                  <div className="p-4 bg-purple-50 rounded-lg">
        <div className="font-medium text-purple-800 mb-2">Throughput (35%)</div>
        <p className="text-purple-700">
          Average completed deliveries per active working day. 
          Normalized with 70 deliveries/day = 100% score.
        </p>
      </div>
                        
                  
                  <div className="p-4 bg-yellow-50 rounded-lg">
        <div className="font-medium text-yellow-800 mb-2">Route Difficulty (10%)</div>
        <p className="text-yellow-700">
          Area-based difficulty score. KB (hardest) = 1.0, Gadong (easiest) = 0.25. 
          Score inverted so easier routes get higher points.
        </p>
      </div>
    

                  <div>
    <h4 className="text-sm font-medium text-gray-800 mb-3">Post-Calculation Adjustments</h4>
    <div className="p-4 bg-orange-50 rounded-lg border-l-4 border-orange-400">
      <div className="font-medium text-orange-800 mb-2">Gap Penalty (Applied After Weighting)</div>
      <p className="text-orange-700">
        Detects gaps over 30min between consecutive deliveries. 
        Applied as: <code className="bg-orange-100 px-1 rounded">Final Score = Weighted Score - Gap Penalty (max 5%)</code>
      </p>
    </div>
  </div>
                  
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <div className="font-medium text-gray-800 mb-2">Score Ranges</div>
                    <div className="space-y-1">
                      <div className="flex items-center space-x-2">
                        <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                        <span className="text-gray-700">85%+ Excellent</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
                        <span className="text-gray-700">70-84% Good</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                        <span className="text-gray-700">&lt;70% Needs Improvement</span>
                      </div>
                    </div>
                  </div>
                  
                </div>
              </div>
            </div>
          )}


          
          {/* Empty State */}
          {!loading && (!data.data || Object.keys(data.data).length === 0) && !error && filters.databaseName && filters.collectionName && (
            <div className="text-center py-12">
              <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No Data Available</h3>
              <p className="text-gray-500">
                No jobs found for the selected date range. Try adjusting your date range.
              </p>
            </div>
          )}
          
          {/* Getting Started */}
          {(!filters.databaseName || !filters.collectionName) && !loading && (
            <div className="text-center py-12">
              <div className="bg-gradient-to-r from-blue-500 to-purple-600 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                <Database className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">Welcome to MongoDB Productivity Analytics</h3>
              <p className="text-gray-500 max-w-md mx-auto mb-6">
                Connect to your MongoDB database and select a date range to start analyzing your dispatcher productivity with machine learning.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-2xl mx-auto text-sm">
                <div className="p-4 bg-white rounded-lg border border-gray-200">
                  <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-2">
                    <span className="text-blue-600 font-bold">1</span>
                  </div>
                  <p className="font-medium text-gray-900">Connect Database</p>
                  <p className="text-gray-500 mt-1">Enter your MongoDB database and collection names</p>
                </div>
                <div className="p-4 bg-white rounded-lg border border-gray-200">
                  <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-2">
                    <span className="text-green-600 font-bold">2</span>
                  </div>
                  <p className="font-medium text-gray-900">Test Connection</p>
                  <p className="text-gray-500 mt-1">Verify your database connection works correctly</p>
                </div>
                <div className="p-4 bg-white rounded-lg border border-gray-200">
                  <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-2">
                    <span className="text-purple-600 font-bold">3</span>
                  </div>
                  <p className="font-medium text-gray-900">Analyze Data</p>
                  <p className="text-gray-500 mt-1">Select date range to calculate productivity scores</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
      
      {/* Overlay for mobile sidebar */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-gray-600 bg-opacity-50 transition-opacity z-10 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        ></div>
      )}
    </div>
    </div>
  );
};

export default App;