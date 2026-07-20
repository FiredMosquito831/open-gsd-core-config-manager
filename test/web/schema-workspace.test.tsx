// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import { renderWeb } from './render-helpers';
import { queryClient } from '../../web/src/state/queryClient.js';

vi.mock('../../web/src/api/schema.js', () => ({
  getSchemaStatus: vi.fn(), refreshSchema: vi.fn(), activateSchemaProposal: vi.fn(),
  cancelSchemaProposal: vi.fn(), resetSchemaToBundled: vi.fn(), getSchema: vi.fn(),
}));
vi.mock('../../web/src/api/configs.js', () => ({ loadConfig: vi.fn() }));

import { getSchemaStatus, refreshSchema, activateSchemaProposal, cancelSchemaProposal, resetSchemaToBundled } from '../../web/src/api/schema.js';
import { SchemaWorkspace } from '../../web/src/components/schema/SchemaWorkspace.js';
import { SchemaStatusControl } from '../../web/src/components/schema/SchemaStatusControl.js';
import { useUiStore } from '../../web/src/state/uiStore.js';

const status = { source: 'bundled' as const, gsdCoreVersion: '1.7.0', generatedAt: '2026-07-20T12:00:00.000Z', lastChecked: '2026-07-20T13:00:00.000Z', commitPrefix: 'abc1234', archiveSha256Prefix: 'def5678' };
const proposal = {
  id: 'opaque-proposal-id', expiresAt: '2026-07-21T12:00:00.000Z', checkedAt: '2026-07-20T14:00:00.000Z', gsdCoreVersion: '1.8.0', documentationDiagnostics: [],
  changes: [
    { path: 'workflow.auto_advance', kind: 'added', after: { type: 'boolean' } },
    { path: 'models.default', kind: 'changed', before: { default: 'a' }, after: { default: 'b' } },
    { path: 'legacy.old', kind: 'deprecated', before: { type: 'string' } },
    { path: 'docs.note', kind: 'documentation-drift', after: { fingerprint: 'changed' } },
  ],
};

beforeEach(() => {
  vi.mocked(getSchemaStatus).mockResolvedValue(status);
  vi.mocked(refreshSchema).mockResolvedValue({ status, proposal });
  vi.mocked(activateSchemaProposal).mockResolvedValue({ ...status, source: 'refreshed', gsdCoreVersion: '1.8.0' });
  vi.mocked(cancelSchemaProposal).mockResolvedValue(undefined);
  vi.mocked(resetSchemaToBundled).mockResolvedValue(status);
  useUiStore.setState({ activeConfigId: null, workspaceMode: 'schema', leftPaneOpen: true, middlePaneOpen: true });
});
afterEach(() => { cleanup(); queryClient.clear(); vi.resetAllMocks(); });

describe('schema maintenance workspace', () => {
  it('keeps a safe persistent status control usable with no selected config', async () => {
    renderWeb(<SchemaStatusControl />);
    expect(await screen.findByRole('button', { name: /Bundled.*gsd-core v1\.7\.0.*7\/20\/2026.*Open schema maintenance/i })).toBeTruthy();
    fireEvent.click(screen.getByRole('button'));
    expect(useUiStore.getState().workspaceMode).toBe('schema');
  });

  it('renders idle status, trust note, and path-free fallback warning', async () => {
    vi.mocked(getSchemaStatus).mockResolvedValue({ ...status, warning: 'server-approved warning' });
    renderWeb(<SchemaWorkspace />);
    expect(await screen.findByRole('heading', { name: 'Keep your schema aligned with gsd-core' })).toBeTruthy();
    expect(screen.getByText('The helper checks the latest stable release and reads allowlisted data only. It never runs remote code.')).toBeTruthy();
    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Check for updates' })).toBeTruthy();
  });

  it('renders fixed grouped review evidence and activates only the entire opaque proposal', async () => {
    renderWeb(<SchemaWorkspace />);
    fireEvent.click(await screen.findByRole('button', { name: 'Check for updates' }));
    expect(await screen.findByRole('heading', { name: 'Review schema changes' })).toBeTruthy();
    expect(screen.getByText('Nothing changes until you activate this proposal.')).toBeTruthy();
    expect(screen.getByText('Activation applies the complete validated proposal.')).toBeTruthy();
    expect(screen.getAllByRole('heading', { level: 2 }).map((node) => node.textContent)).toEqual(expect.arrayContaining(['Added (1)', 'Changed (1)', 'Deprecated (1)', 'Documentation notes (1)']));
    expect(screen.queryByRole('button', { name: /activate .*workflow/i })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Activate schema' }));
    await waitFor(() => expect(activateSchemaProposal).toHaveBeenCalledWith('opaque-proposal-id'));
  });

  it('shows no activation action when no semantic changes are found', async () => {
    vi.mocked(refreshSchema).mockResolvedValue({ status: { ...status, lastChecked: '2026-07-20T14:00:00.000Z' }, noChange: true });
    renderWeb(<SchemaWorkspace />);
    fireEvent.click(await screen.findByRole('button', { name: 'Check for updates' }));
    expect(await screen.findByRole('heading', { name: 'Your schema is up to date' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Activate schema' })).toBeNull();
  });

  it('rehydrates a server-retained proposal after remount so it remains reviewable and activatable', async () => {
    vi.mocked(getSchemaStatus).mockResolvedValue({ ...status, proposal });
    renderWeb(<SchemaWorkspace />);
    expect(await screen.findByRole('button', { name: 'Activate schema' })).toBeTruthy();

    cleanup(); queryClient.clear(); renderWeb(<SchemaWorkspace />);
    fireEvent.click(await screen.findByRole('button', { name: 'Activate schema' }));
    await waitFor(() => expect(activateSchemaProposal).toHaveBeenCalledWith('opaque-proposal-id'));
  });

  it('cancels the server proposal, evicts schema status, and does not rehydrate it on remount', async () => {
    vi.mocked(getSchemaStatus).mockResolvedValueOnce({ ...status, proposal }).mockResolvedValue(status);
    renderWeb(<SchemaWorkspace />);
    expect(await screen.findByRole('button', { name: 'Cancel review' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel review' }));
    expect(await screen.findByText('Schema update review cancelled. Your active schema was not changed.')).toBeTruthy();
    expect(cancelSchemaProposal).toHaveBeenCalledWith('opaque-proposal-id');
    cleanup(); queryClient.clear(); renderWeb(<SchemaWorkspace />);
    expect(await screen.findByRole('button', { name: 'Check for updates' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Cancel review' })).toBeNull();
  });

  it('keeps the proposal visible and reports a cancellation failure', async () => {
    vi.mocked(getSchemaStatus).mockResolvedValue({ ...status, proposal });
    vi.mocked(cancelSchemaProposal).mockRejectedValue(new Error('network unavailable'));
    renderWeb(<SchemaWorkspace />);
    fireEvent.click(await screen.findByRole('button', { name: 'Cancel review' }));
    expect(await screen.findByRole('heading', { name: 'Couldn’t cancel this schema update review' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Cancel review' })).toBeTruthy();
    expect(screen.queryByText('Schema update review cancelled. Your active schema was not changed.')).toBeNull();
  });

  it('provides a keyboard-safe reset confirmation', async () => {
    vi.mocked(getSchemaStatus).mockResolvedValue({ ...status, source: 'refreshed', activatedAt: '2026-07-20T12:00:00.000Z' });
    renderWeb(<SchemaWorkspace />);
    const reset = await screen.findByRole('button', { name: 'Reset to bundled schema' });
    reset.focus(); fireEvent.click(reset);
    const dialog = await screen.findByRole('alertdialog', { name: 'Reset to bundled schema' });
    expect(document.activeElement?.textContent).toBe('Keep current schema');
    fireEvent.keyDown(document.activeElement!, { key: 'Escape' });
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(document.activeElement).toBe(reset);
  });

  it('uses activatedAt for refreshed status controls', async () => {
    vi.mocked(getSchemaStatus).mockResolvedValue({ ...status, source: 'refreshed', activatedAt: '2026-07-21T12:00:00.000Z' });
    renderWeb(<SchemaStatusControl />);
    expect(await screen.findByRole('button', { name: /Refreshed.*7\/21\/2026.*Open schema maintenance/i })).toBeTruthy();
  });

  it('keeps raw rejected remote data out of the DOM and exposes visual backstop hooks', async () => {
    vi.mocked(getSchemaStatus).mockRejectedValue(new Error('https://secret.example/C:/private/archive.zip'));
    renderWeb(<SchemaWorkspace />);
    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(document.body.textContent).not.toContain('secret.example');
    expect(document.body.textContent).not.toContain('private');
    expect(document.querySelector('[data-schema-backstop="desktop-overflow"]')).toBeTruthy();
    expect(document.querySelector('[data-schema-backstop="many-keys"]')).toBeTruthy();
    expect(document.querySelector('[data-schema-backstop="compact-320"]')).toBeTruthy();
  });
});
