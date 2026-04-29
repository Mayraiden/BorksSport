type SyncSource = 'commerceml' | 'sbis-api'

interface ActiveSyncRun {
	token: string
	source: SyncSource
	startedAt: string
}

let activeSyncRun: ActiveSyncRun | null = null

function acquireSyncLock(source: SyncSource): { ok: true; run: ActiveSyncRun } | { ok: false; active: ActiveSyncRun } {
	if (activeSyncRun) {
		return { ok: false, active: activeSyncRun }
	}

	const run: ActiveSyncRun = {
		token: `${source}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
		source,
		startedAt: new Date().toISOString(),
	}
	activeSyncRun = run
	return { ok: true, run }
}

function releaseSyncLock(token: string): void {
	if (!activeSyncRun) return
	if (activeSyncRun.token !== token) return
	activeSyncRun = null
}

function getActiveSyncRun(): ActiveSyncRun | null {
	return activeSyncRun
}

export { acquireSyncLock, releaseSyncLock, getActiveSyncRun, type SyncSource, type ActiveSyncRun }
