'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface PerformanceMetrics {
  averageResponseTime: number;
  requestsPerSecond: number;
  errorRate: number;
  p95ResponseTime: number;
  memoryUsage: number;
  cpuUsage: number;
}

interface SecurityStatus {
  overallScore: number;
  criticalIssues: number;
  lastAudit: string;
  recommendations: string[];
}

interface SystemHealth {
  database: 'healthy' | 'warning' | 'error';
  api: 'healthy' | 'warning' | 'error';
  cache: 'healthy' | 'warning' | 'error';
  uptime: string;
}

export default function MonitoringDashboard() {
  const [performanceData, setPerformanceData] = useState<PerformanceMetrics | null>(null);
  const [securityStatus, setSecurityStatus] = useState<SecurityStatus | null>(null);
  const [systemHealth, setSystemHealth] = useState<SystemHealth | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchMonitoringData();
    const interval = setInterval(fetchMonitoringData, 30000); // Refresh every 30 seconds
    return () => clearInterval(interval);
  }, []);

  const fetchMonitoringData = async () => {
    try {
      const [perfResponse, secResponse, healthResponse] = await Promise.all([
        fetch('/api/monitoring/performance'),
        fetch('/api/monitoring/security'),
        fetch('/api/monitoring/health')
      ]);

      if (perfResponse.ok) {
        const perfData = await perfResponse.json();
        setPerformanceData(perfData);
      }

      if (secResponse.ok) {
        const secData = await secResponse.json();
        setSecurityStatus(secData);
      }

      if (healthResponse.ok) {
        const healthData = await healthResponse.json();
        setSystemHealth(healthData);
      }

      setLoading(false);
    } catch (err) {
      setError('Failed to fetch monitoring data');
      setLoading(false);
    }
  };

  const runSecurityAudit = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/security/audit', { method: 'POST' });
      if (response.ok) {
        await fetchMonitoringData();
      }
    } catch (err) {
      setError('Failed to run security audit');
    } finally {
      setLoading(false);
    }
  };

  const runPerformanceTest = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/monitoring/performance/test', { method: 'POST' });
      if (response.ok) {
        await fetchMonitoringData();
      }
    } catch (err) {
      setError('Failed to run performance test');
    } finally {
      setLoading(false);
    }
  };

  const getHealthBadgeColor = (status: string) => {
    switch (status) {
      case 'healthy': return 'bg-green-500';
      case 'warning': return 'bg-yellow-500';
      case 'error': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  if (loading && !performanceData) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-500 mx-auto"></div>
          <p className="mt-4 text-lg">Loading monitoring data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">System Monitoring Dashboard</h1>
        <div className="flex gap-2">
          <Button onClick={runSecurityAudit} disabled={loading}>
            Run Security Audit
          </Button>
          <Button onClick={runPerformanceTest} disabled={loading} variant="outline">
            Run Performance Test
          </Button>
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="performance">Performance</TabsTrigger>
          <TabsTrigger value="security">Security</TabsTrigger>
          <TabsTrigger value="health">System Health</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Overall Health</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {systemHealth ? (
                    <Badge className={getHealthBadgeColor(
                      Object.values(systemHealth).includes('error') ? 'error' :
                      Object.values(systemHealth).includes('warning') ? 'warning' : 'healthy'
                    )}>
                      {Object.values(systemHealth).includes('error') ? 'Critical' :
                       Object.values(systemHealth).includes('warning') ? 'Warning' : 'Healthy'}
                    </Badge>
                  ) : 'Loading...'}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Response Time</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {performanceData ? `${performanceData.averageResponseTime}ms` : 'N/A'}
                </div>
                <p className="text-xs text-muted-foreground">Average response time</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Security Score</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {securityStatus ? `${securityStatus.overallScore}%` : 'N/A'}
                </div>
                <p className="text-xs text-muted-foreground">
                  {securityStatus?.criticalIssues || 0} critical issues
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Error Rate</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {performanceData ? `${performanceData.errorRate.toFixed(2)}%` : 'N/A'}
                </div>
                <p className="text-xs text-muted-foreground">Last 24 hours</p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="performance" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Performance Metrics</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {performanceData ? (
                  <>
                    <div className="flex justify-between">
                      <span>Average Response Time:</span>
                      <span className="font-semibold">{performanceData.averageResponseTime}ms</span>
                    </div>
                    <div className="flex justify-between">
                      <span>P95 Response Time:</span>
                      <span className="font-semibold">{performanceData.p95ResponseTime}ms</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Requests/Second:</span>
                      <span className="font-semibold">{performanceData.requestsPerSecond}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Memory Usage:</span>
                      <span className="font-semibold">{performanceData.memoryUsage}MB</span>
                    </div>
                    <div className="flex justify-between">
                      <span>CPU Usage:</span>
                      <span className="font-semibold">{performanceData.cpuUsage}%</span>
                    </div>
                  </>
                ) : (
                  <p>No performance data available</p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Performance Trends</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-64 flex items-center justify-center text-muted-foreground">
                  Performance charts would be displayed here
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="security" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Security Status</CardTitle>
            </CardHeader>
            <CardContent>
              {securityStatus ? (
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span>Overall Security Score:</span>
                    <Badge variant={securityStatus.overallScore >= 80 ? 'default' : 'destructive'}>
                      {securityStatus.overallScore}%
                    </Badge>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>Critical Issues:</span>
                    <Badge variant={securityStatus.criticalIssues === 0 ? 'default' : 'destructive'}>
                      {securityStatus.criticalIssues}
                    </Badge>
                  </div>
                  <div className="flex justify-between">
                    <span>Last Audit:</span>
                    <span className="font-semibold">{new Date(securityStatus.lastAudit).toLocaleString()}</span>
                  </div>
                  
                  {securityStatus.recommendations.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="font-semibold">Recommendations:</h4>
                      <ul className="list-disc list-inside space-y-1">
                        {securityStatus.recommendations.map((rec, index) => (
                          <li key={index} className="text-sm">{rec}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              ) : (
                <p>No security data available</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="health" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>System Components</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {systemHealth ? (
                  <>
                    <div className="flex justify-between items-center">
                      <span>Database:</span>
                      <Badge className={getHealthBadgeColor(systemHealth.database)}>
                        {systemHealth.database}
                      </Badge>
                    </div>
                    <div className="flex justify-between items-center">
                      <span>API:</span>
                      <Badge className={getHealthBadgeColor(systemHealth.api)}>
                        {systemHealth.api}
                      </Badge>
                    </div>
                    <div className="flex justify-between items-center">
                      <span>Cache:</span>
                      <Badge className={getHealthBadgeColor(systemHealth.cache)}>
                        {systemHealth.cache}
                      </Badge>
                    </div>
                    <div className="flex justify-between">
                      <span>Uptime:</span>
                      <span className="font-semibold">{systemHealth.uptime}</span>
                    </div>
                  </>
                ) : (
                  <p>No health data available</p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>System Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex justify-between">
                  <span>Environment:</span>
                  <span className="font-semibold">{process.env.NODE_ENV}</span>
                </div>
                <div className="flex justify-between">
                  <span>Version:</span>
                  <span className="font-semibold">1.0.0</span>
                </div>
                <div className="flex justify-between">
                  <span>Last Deployment:</span>
                  <span className="font-semibold">Today</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}