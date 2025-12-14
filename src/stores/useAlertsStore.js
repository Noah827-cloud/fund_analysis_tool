import { defineStore } from 'pinia';
import { createAlert, deleteAlert, getAlerts, updateAlert } from '../services/dataService.js';

export const useAlertsStore = defineStore('alerts', {
  state: () => ({
    loading: false,
    error: null,
    alerts: [],
  }),
  actions: {
    async load(force = false) {
      this.loading = true;
      this.error = null;
      try {
        this.alerts = await getAlerts({ force });
      } catch (e) {
        this.error = e;
        this.alerts = [];
      } finally {
        this.loading = false;
      }
    },

    /**
     * @param {{ fundCode: string, fundName: string, type: import('../contracts/types.js').Alert['type'], condition: import('../contracts/types.js').Alert['condition'], targetValue: number, unit: import('../contracts/types.js').Alert['unit'] }} payload
     */
    async create(payload) {
      const created = await createAlert(payload);
      this.alerts = [...(this.alerts || []), created];
      return created;
    },

    async toggle(id) {
      const target = (this.alerts || []).find((a) => String(a.id) === String(id));
      if (!target) return null;

      const nextStatus = target.status === 'active' ? 'paused' : 'active';
      const updated = await updateAlert({ id: target.id, patch: { status: nextStatus } });
      this.alerts = (this.alerts || []).map((a) => (String(a.id) === String(id) ? updated : a));
      return updated;
    },

    async remove(id) {
      const ok = await deleteAlert({ id });
      if (!ok) return false;
      this.alerts = (this.alerts || []).filter((a) => String(a.id) !== String(id));
      return true;
    },
  },
});
