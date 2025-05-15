export enum ANSStatus {
    OK = 'OK',
    NOT_FOUND = 'NOT_FOUND'
}

export class ANSService {
    getStatus() {
        return { status: ANSStatus.OK };
    }

    getAgent(id: string) {
        // Mock implementation for testing
        if (id === 'unknown-id') {
            return { status: ANSStatus.NOT_FOUND };
        }
        return { status: ANSStatus.OK };
    }
}