import { DatabaseService } from './databaseService';

export class DatabaseServiceFactory {
    private static instance: DatabaseService | null = null;

    static async getInstance(): Promise<DatabaseService> {
        if (!this.instance) {
            this.instance = new DatabaseService();
            await this.instance.initialize();
        }
        return this.instance;
    }

    static async resetDatabase(): Promise<void> {
        if (this.instance) {
            await this.instance.close();
            this.instance = null;
        }
    }
}