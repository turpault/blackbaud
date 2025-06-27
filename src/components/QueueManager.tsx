import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { constituentQueue, attachmentQueue, QueueStats } from '../utils/concurrentQueue';

interface QueueManagerProps {
  showDetails?: boolean;
}

const QueueManager: React.FC<QueueManagerProps> = ({ showDetails = false }) => {
  const { t } = useTranslation();
  const [constituentStats, setConstituentStats] = useState<QueueStats>(constituentQueue.getStats());
  const [attachmentStats, setAttachmentStats] = useState<QueueStats>(attachmentQueue.getStats());
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    const updateStats = () => {
      setConstituentStats(constituentQueue.getStats());
      setAttachmentStats(attachmentQueue.getStats());
    };

    const interval = setInterval(updateStats, 1000);
    return () => clearInterval(interval);
  }, []);

  const getQueueStatus = (stats: QueueStats) => {
    if (stats.runningTasks > 0) return 'active';
    if (stats.pendingTasks > 0) return 'pending';
    if (stats.failedTasks > 0) return 'failed';
    return 'idle';
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return '#28a745';
      case 'pending': return '#ffc107';
      case 'failed': return '#dc3545';
      default: return '#6c757d';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active': return '🔄';
      case 'pending': return '⏳';
      case 'failed': return '❌';
      default: return '✅';
    }
  };

  const formatTime = (ms: number) => {
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  };

  const clearQueue = (queue: any, name: string) => {
    queue.clear();
    console.log(`🧹 Cleared ${name} queue`);
  };

  const totalTasks = constituentStats.totalTasks + attachmentStats.totalTasks;
  const totalCompleted = constituentStats.completedTasks + attachmentStats.completedTasks;
  const totalFailed = constituentStats.failedTasks + attachmentStats.failedTasks;
  const totalPending = constituentStats.pendingTasks + attachmentStats.pendingTasks;
  const totalRunning = constituentStats.runningTasks + attachmentStats.runningTasks;

  if (!showDetails && totalTasks === 0) {
    return null;
  }

  return (
    <div style={{
      backgroundColor: 'white',
      border: '1px solid #e9ecef',
      borderRadius: '8px',
      padding: '16px',
      marginBottom: '16px',
      boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '12px'
      }}>
        <h3 style={{
          margin: 0,
          fontSize: '16px',
          fontWeight: 'bold',
          color: '#495057',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          {t('queueManager.title')}
          {totalRunning > 0 && (
            <span style={{
              backgroundColor: '#28a745',
              color: 'white',
              padding: '2px 6px',
              borderRadius: '12px',
              fontSize: '11px',
              fontWeight: 'bold'
            }}>
              {totalRunning} {t('queueManager.active')}
            </span>
          )}
        </h3>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            style={{
              padding: '4px 8px',
              backgroundColor: '#6c757d',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '12px'
            }}
          >
            {isExpanded ? t('queueManager.hideDetails') : t('queueManager.showDetails')}
          </button>

          <button
            onClick={() => {
              clearQueue(constituentQueue, 'Constituent');
              clearQueue(attachmentQueue, 'Attachment');
            }}
            style={{
              padding: '4px 8px',
              backgroundColor: '#dc3545',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '12px'
            }}
          >
            {t('queueManager.clearAll')}
          </button>
        </div>
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
        gap: '12px',
        marginBottom: '16px'
      }}>
        <div style={{
          textAlign: 'center',
          padding: '8px',
          backgroundColor: '#f8f9fa',
          borderRadius: '6px'
        }}>
          <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#495057' }}>
            {totalTasks}
          </div>
          <div style={{ fontSize: '12px', color: '#6c757d' }}>{t('queueManager.totalTasks')}</div>
        </div>

        <div style={{
          textAlign: 'center',
          padding: '8px',
          backgroundColor: '#d4edda',
          borderRadius: '6px'
        }}>
          <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#155724' }}>
            {totalCompleted}
          </div>
          <div style={{ fontSize: '12px', color: '#155724' }}>{t('queueManager.completed')}</div>
        </div>

        <div style={{
          textAlign: 'center',
          padding: '8px',
          backgroundColor: '#fff3cd',
          borderRadius: '6px'
        }}>
          <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#856404' }}>
            {totalPending}
          </div>
          <div style={{ fontSize: '12px', color: '#856404' }}>{t('queueManager.pending')}</div>
        </div>

        <div style={{
          textAlign: 'center',
          padding: '8px',
          backgroundColor: '#f8d7da',
          borderRadius: '6px'
        }}>
          <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#721c24' }}>
            {totalFailed}
          </div>
          <div style={{ fontSize: '12px', color: '#721c24' }}>{t('queueManager.failed')}</div>
        </div>
      </div>

      {isExpanded && (
        <div style={{ borderTop: '1px solid #e9ecef', paddingTop: '16px' }}>
          <h4 style={{ margin: '0 0 12px 0', fontSize: '14px', color: '#495057' }}>
            Queue Details
          </h4>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{
              border: '1px solid #e9ecef',
              borderRadius: '6px',
              padding: '12px'
            }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '8px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '16px' }}>👥</span>
                  <span style={{ fontWeight: 'bold', color: '#495057' }}>Constituent Queue</span>
                  <span style={{
                    color: getStatusColor(getQueueStatus(constituentStats)),
                    fontSize: '12px'
                  }}>
                    {getStatusIcon(getQueueStatus(constituentStats))} {getQueueStatus(constituentStats)}
                  </span>
                </div>
                <button
                  onClick={() => clearQueue(constituentQueue, 'Constituent')}
                  style={{
                    padding: '2px 6px',
                    backgroundColor: '#dc3545',
                    color: 'white',
                    border: 'none',
                    borderRadius: '3px',
                    cursor: 'pointer',
                    fontSize: '10px'
                  }}
                >
                  Clear
                </button>
              </div>

              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(4, 1fr)',
                gap: '8px',
                fontSize: '12px'
              }}>
                <div>Total: {constituentStats.totalTasks}</div>
                <div>Completed: {constituentStats.completedTasks}</div>
                <div>Pending: {constituentStats.pendingTasks}</div>
                <div>Failed: {constituentStats.failedTasks}</div>
                <div>Running: {constituentStats.runningTasks}/2</div>
                <div>Avg Time: {formatTime(constituentStats.averageExecutionTime)}</div>
              </div>
            </div>

            <div style={{
              border: '1px solid #e9ecef',
              borderRadius: '6px',
              padding: '12px'
            }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '8px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '16px' }}>📎</span>
                  <span style={{ fontWeight: 'bold', color: '#495057' }}>Attachment Queue</span>
                  <span style={{
                    color: getStatusColor(getQueueStatus(attachmentStats)),
                    fontSize: '12px'
                  }}>
                    {getStatusIcon(getQueueStatus(attachmentStats))} {getQueueStatus(attachmentStats)}
                  </span>
                </div>
                <button
                  onClick={() => clearQueue(attachmentQueue, 'Attachment')}
                  style={{
                    padding: '2px 6px',
                    backgroundColor: '#dc3545',
                    color: 'white',
                    border: 'none',
                    borderRadius: '3px',
                    cursor: 'pointer',
                    fontSize: '10px'
                  }}
                >
                  Clear
                </button>
              </div>

              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(4, 1fr)',
                gap: '8px',
                fontSize: '12px'
              }}>
                <div>Total: {attachmentStats.totalTasks}</div>
                <div>Completed: {attachmentStats.completedTasks}</div>
                <div>Pending: {attachmentStats.pendingTasks}</div>
                <div>Failed: {attachmentStats.failedTasks}</div>
                <div>Running: {attachmentStats.runningTasks}/3</div>
                <div>Avg Time: {formatTime(attachmentStats.averageExecutionTime)}</div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default QueueManager;
