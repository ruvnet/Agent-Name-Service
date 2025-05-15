import { ANSService } from '../../src/core/ansService';
import { ANSStatus } from '../../src/types';

describe('ANSService', () => {
    let ansService: ANSService;

    beforeEach(() => {
        ansService = new ANSService();
    });

    it('should return OK status', () => {
        const result = ansService.getStatus();
        expect(result.status).toBe(ANSStatus.OK);
    });

    it('should return NOT_FOUND status for unknown agent', () => {
        const result = ansService.getAgent('unknown-id');
        expect(result.status).toBe(ANSStatus.NOT_FOUND);
    });
});