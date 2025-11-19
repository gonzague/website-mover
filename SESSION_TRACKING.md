# Session/Job Tracking System

## Overview

This document describes the session/job tracking system that allows users to:
- Track ongoing migrations
- Resume interrupted operations
- View migration history
- Control active operations (pause, cancel)
- Reconnect after closing the browser

## Architecture

### Backend Components

#### 1. Session Manager (`internal/session/session.go`)
- **Singleton pattern** - one global manager
- **In-memory storage** (can be upgraded to persistent storage)
- **Auto-cleanup** - removes completed jobs after 24 hours
- **Thread-safe** - uses mutex for concurrent access

#### 2. Job Structure
```go
type Job struct {
    ID          string        // UUID
    Type        JobType       // scan, plan, transfer
    Status      JobStatus     // pending, running, completed, failed, cancelled
    CreatedAt   time.Time
    UpdatedAt   time.Time
    CompletedAt *time.Time
    
    // Server configs
    SourceConfig *ConnectionConfig
    DestConfig   *ConnectionConfig
    
    // Results
    ScanResult     *ScanResult
    PlanResult     *PlanResult
    TransferResult *TransferResult
    
    // Progress tracking
    Progress interface{}
    
    // Error tracking
    ErrorMessage string
}
```

#### 3. API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/sessions` | GET | List all jobs |
| `/api/sessions` | DELETE | Clear completed jobs |
| `/api/sessions/active` | GET | Get active jobs only |
| `/api/sessions/{id}` | GET | Get specific job details |
| `/api/sessions/{id}` | DELETE | Cancel/delete specific job |

### Frontend Components

#### 1. Session Storage Enhancement
```typescript
interface SessionData {
  currentJobId?: string  // Active job ID
  jobHistory: string[]   // Recent job IDs
  // ... existing fields
}
```

#### 2. New Features

**Resume Capability:**
- On app load, check for active jobs
- Show "Resume Migration" option if found
- Reconnect to SSE stream for that job

**Job History:**
- View past migrations
- Restart completed migrations
- Clean up old jobs

**Better Control:**
- Pause/resume transfers
- Cancel ongoing operations
- Real-time status updates

## Integration Points

### Scan Handler
1. Create job when scan starts
2. Update job status: pending → running
3. Store progress updates in job
4. Store scan result when complete
5. Mark job as completed/failed

### Transfer Handler
1. Create job when transfer starts
2. Update job status during transfer
3. Allow reconnection to ongoing transfer
4. Store transfer result
5. Support pause/resume/cancel

### Frontend
1. Store `jobId` in localStorage
2. Check for active jobs on mount
3. Provide "Resume" UI if active job exists
4. Reconnect to SSE with job ID
5. Display job history

## Implementation Status

### ✅ Completed
- [x] Session manager base implementation
- [x] Job structure and types
- [x] API endpoints for session management
- [x] Thread-safe job operations
- [x] Auto-cleanup routine

### 🚧 In Progress
- [ ] Integrate session manager into scan handler
- [ ] Integrate session manager into transfer handler
- [ ] Frontend session API client
- [ ] Resume capability UI
- [ ] Job history UI

### 📋 TODO
- [ ] Persistent storage (database/file)
- [ ] Job progress streaming via WebSocket
- [ ] Multi-user support with authentication
- [ ] Job scheduling/queue system
- [ ] Export job reports

## Usage Examples

### Backend

```go
// Create a new job
mgr := session.GetManager()
jobID := mgr.CreateJob(session.JobTypeScan, sourceConfig, nil)

// Update status
mgr.UpdateJobStatus(jobID, session.JobStatusRunning)

// Update progress
mgr.UpdateJobProgress(jobID, scanProgress)

// Store result
mgr.SetJobResult(jobID, scanResult)

// Mark complete
mgr.UpdateJobStatus(jobID, session.JobStatusCompleted)
```

### Frontend

```typescript
// Check for active jobs
const activeJobs = await fetch('/api/sessions/active').then(r => r.json())

if (activeJobs.length > 0) {
  // Show resume UI
  showResumeDialog(activeJobs[0])
}

// Get job details
const job = await fetch(`/api/sessions/${jobId}`).then(r => r.json())

// Cancel job
await fetch(`/api/sessions/${jobId}`, { method: 'DELETE' })
```

## Benefits

1. **Reliability:** Don't lose progress on browser refresh
2. **Transparency:** Always know what's happening
3. **Control:** Pause, resume, cancel operations
4. **History:** Track all migrations
5. **Debugging:** Full audit trail of operations

## Future Enhancements

1. **Persistent Storage:** Survive server restarts
2. **WebSocket Support:** Real-time updates without SSE
3. **Job Queue:** Schedule migrations
4. **Notifications:** Email/Slack when jobs complete
5. **Metrics:** Track performance, success rates
6. **Rollback:** Undo migrations if needed

