import { createMockDatabase } from '../test-utils';

// Mock the DatabaseService class
const mockInitialize = jest.fn().mockResolvedValue(undefined);
const mockClose = jest.fn().mockResolvedValue(undefined);

jest.mock('../../src/database/database-service', () => {
  return {
    DatabaseService: jest.fn().mockImplementation(() => {
      return {
        initialize: mockInitialize,
        close: mockClose
      };
    })
  };
});

// Mock fs module
jest.mock('fs/promises', () => {
  return {
    unlink: jest.fn().mockResolvedValue(undefined)
  };
});

// Import after mocking
import { DatabaseServiceFactory } from '../../src/database/database-service-factory';

describe('DatabaseServiceFactory', () => {
  beforeEach(() => {
    // Reset mocks and internal instance
    jest.clearAllMocks();
    (DatabaseServiceFactory as any).instance = null;
  });
  
  describe('getInstance', () => {
    it('should create a new instance if none exists', async () => {
      // Arrange
      const { DatabaseService } = require('../../src/database/database-service');
      
      // Act
      const instance = await DatabaseServiceFactory.getInstance();
      
      // Assert
      expect(DatabaseService).toHaveBeenCalledTimes(1);
      expect(mockInitialize).toHaveBeenCalledTimes(1);
      expect(instance).toBeDefined();
    });
    
    it('should return existing instance if already created', async () => {
      // Arrange
      const { DatabaseService } = require('../../src/database/database-service');
      
      // Act
      const instance1 = await DatabaseServiceFactory.getInstance();
      const instance2 = await DatabaseServiceFactory.getInstance();
      
      // Assert
      expect(DatabaseService).toHaveBeenCalledTimes(1);
      expect(mockInitialize).toHaveBeenCalledTimes(1);
      expect(instance1).toBe(instance2);
    });
    
    it('should handle initialization errors', async () => {
      // Arrange
      const error = new Error('Initialization failed');
      mockInitialize.mockRejectedValueOnce(error);
      
      // Act & Assert
      await expect(DatabaseServiceFactory.getInstance()).rejects.toThrow('Initialization failed');
    });
  });
  
  describe('resetDatabase', () => {
    it('should close existing instance and delete database file', async () => {
      // Arrange
      const fs = require('fs/promises');
      
      // Create an instance first
      await DatabaseServiceFactory.getInstance();
      
      // Act
      await DatabaseServiceFactory.resetDatabase();
      
      // Assert
      expect(mockClose).toHaveBeenCalledTimes(1);
      expect(fs.unlink).toHaveBeenCalledWith('./ans_database.sqlite');
      expect((DatabaseServiceFactory as any).instance).toBeNull();
    });
    
    it('should not fail if no instance exists', async () => {
      // Arrange
      const fs = require('fs/promises');
      
      // Act
      await DatabaseServiceFactory.resetDatabase();
      
      // Assert
      expect(mockClose).not.toHaveBeenCalled();
      expect(fs.unlink).toHaveBeenCalledWith('./ans_database.sqlite');
    });
    
    it('should ignore file not found errors during unlink', async () => {
      // Arrange
      const fs = require('fs/promises');
      const error = new Error('File not found');
      fs.unlink.mockRejectedValueOnce(error);
      
      // Act
      await expect(DatabaseServiceFactory.resetDatabase()).resolves.not.toThrow();
      
      // Assert
      expect(fs.unlink).toHaveBeenCalledWith('./ans_database.sqlite');
    });
  });
});