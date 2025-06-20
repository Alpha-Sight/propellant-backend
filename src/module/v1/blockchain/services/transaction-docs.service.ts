import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Transaction, TransactionDocument } from '../schemas/transaction.schema';
import * as fs from 'fs';
import * as path from 'path';
import * as csv from 'csv-stringify';

@Injectable()
export class TransactionDocsService {
  private readonly logger = new Logger(TransactionDocsService.name);
  
  constructor(
    @InjectModel(Transaction.name) private transactionModel: Model<TransactionDocument>,
  ) {}
  
  /**
   * Generate a CSV report of successful transactions
   */
  async generateTransactionReport(fromDate: Date, toDate: Date): Promise<string> {
    this.logger.log(`Generating transaction report from ${fromDate} to ${toDate}`);
    
    const transactions = await this.transactionModel.find({
      status: 'SUCCESS',
      createdAt: { $gte: fromDate, $lte: toDate },
    }).sort({ createdAt: 1 });
    
    if (transactions.length === 0) {
      throw new Error('No successful transactions found in the specified date range');
    }
    
    // Format for CSV export
    const data = transactions.map(tx => ({
      transactionId: tx.transactionId,
      userAddress: tx.userAddress,
      accountAddress: tx.accountAddress,
      target: tx.target,
      description: tx.description,
      transactionHash: tx.transactionHash,
      blockNumber: tx.blockNumber,
      gasUsed: tx.gasUsed,
      createdAt: tx.createdAt.toISOString(),
      completedAt: tx.updatedAt?.toISOString(),
    }));
    
    // Create directory if it doesn't exist
    const reportDir = path.join(process.cwd(), 'reports');
    if (!fs.existsSync(reportDir)) {
      fs.mkdirSync(reportDir, { recursive: true });
    }
    
    // Generate filename with timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = path.join(reportDir, `transactions-${timestamp}.csv`);
    
    return new Promise((resolve, reject) => {
      csv.stringify(data, { header: true }, (err, output) => {
        if (err) {
          this.logger.error(`Failed to generate CSV: ${err.message}`);
          return reject(err);
        }
        
        fs.writeFile(filename, output, (err) => {
          if (err) {
            this.logger.error(`Failed to write CSV file: ${err.message}`);
            return reject(err);
          }
          
          this.logger.log(`Transaction report saved to ${filename}`);
          resolve(filename);
        });
      });
    });
  }
  
  /**
   * Get transaction statistics
   */
  async getTransactionStats(): Promise<any> {
    const [totalTransactions, successfulTransactions, failedTransactions, pendingTransactions, gasUsageStats] = 
      await Promise.all([
        this.transactionModel.countDocuments(),
        this.transactionModel.countDocuments({ status: 'SUCCESS' }),
        this.transactionModel.countDocuments({ status: 'FAILED' }),
        this.transactionModel.countDocuments({ status: 'PENDING' }),
        this.transactionModel.aggregate([
          { $match: { status: 'SUCCESS', gasUsed: { $exists: true } } },
          { $group: {
            _id: null,
            totalGasUsed: { $sum: { $toDouble: "$gasUsed" } },
            avgGasUsed: { $avg: { $toDouble: "$gasUsed" } },
            maxGasUsed: { $max: { $toDouble: "$gasUsed" } },
            minGasUsed: { $min: { $toDouble: "$gasUsed" } },
          } }
        ]),
      ]);
    
    return {
      totalTransactions,
      successfulTransactions,
      failedTransactions,
      pendingTransactions,
      successRate: totalTransactions ? (successfulTransactions / totalTransactions * 100).toFixed(2) + '%' : '0%',
      gasStats: gasUsageStats.length > 0 ? {
        totalGasUsed: gasUsageStats[0].totalGasUsed.toString(),
        avgGasUsed: Math.round(gasUsageStats[0].avgGasUsed).toString(),
        maxGasUsed: gasUsageStats[0].maxGasUsed.toString(),
        minGasUsed: gasUsageStats[0].minGasUsed.toString(),
      } : {
        totalGasUsed: '0',
        avgGasUsed: '0',
        maxGasUsed: '0',
        minGasUsed: '0',
      },
    };
  }
}