import { Engine } from '../engine/src/trade/engine';
import { expect } from 'chai';
import { describe, it, beforeEach } from 'mocha';

describe('Exchange Engine Tests', () => {
  let engine: Engine;

  beforeEach(() => {
    engine = new Engine();
    // Seed initial balances for testing
    engine.onRamp('user1', BigInt(1000000000000)); // 10,000 USDC
    engine.onRamp('user2', BigInt(1000000000000)); // 10,000 USDC
    engine.onRamp('user3', BigInt(1000000000000)); // 10,000 USDC
  });

  describe('Limit Order Tests', () => {
    it('should create a limit buy order successfully', async () => {
      const result = engine.createOrder(
        'BTC_USDC',
        '100000000', // 1 BTC
        '50000000000', // 500 USDC
        'buy',
        'user1',
        'limit'
      );

      expect(result.orderId).to.be.a('string');
      expect(result.executedQty).to.equal(BigInt(0));
      expect(result.fills).to.be.an('array').that.is.empty;
    });

    it('should create a limit sell order successfully', async () => {
      const result = engine.createOrder(
        'BTC_USDC',
        '100000000', // 1 BTC
        '50000000000', // 500 USDC
        'sell',
        'user1',
        'limit'
      );

      expect(result.orderId).to.be.a('string');
      expect(result.executedQty).to.equal(BigInt(0));
      expect(result.fills).to.be.an('array').that.is.empty;
    });

    it('should match limit orders at same price', async () => {
      // Create sell order first
      engine.createOrder(
        'BTC_USDC',
        '100000000', // 1 BTC
        '50000000000', // 500 USDC
        'sell',
        'user1',
        'limit'
      );

      // Create matching buy order
      const result = engine.createOrder(
        'BTC_USDC',
        '100000000', // 1 BTC
        '50000000000', // 500 USDC
        'buy',
        'user2',
        'limit'
      );

      expect(result.executedQty).to.equal(BigInt('100000000'));
      expect(result.fills).to.have.lengthOf(1);
      expect(result.fills[0].price).to.equal(BigInt('50000000000'));
    });
  });

  describe('Market Order Tests', () => {
    it('should execute market buy order against existing sells', async () => {
      // Create sell order first
      engine.createOrder(
        'BTC_USDC',
        '100000000', // 1 BTC
        '50000000000', // 500 USDC
        'sell',
        'user1',
        'limit'
      );

      // Create market buy
      const result = engine.createOrder(
        'BTC_USDC',
        '100000000', // 1 BTC
        '0', // Price not needed for market orders
        'buy',
        'user2',
        'market'
      );

      expect(result.executedQty).to.equal(BigInt('100000000'));
      expect(result.fills).to.have.lengthOf(1);
    });

    it('should execute market sell order against existing buys', async () => {
      // Create buy order first
      engine.createOrder(
        'BTC_USDC',
        '100000000', // 1 BTC
        '50000000000', // 500 USDC
        'buy',
        'user1',
        'limit'
      );

      // Create market sell
      const result = engine.createOrder(
        'BTC_USDC',
        '100000000', // 1 BTC
        '0', // Price not needed for market orders
        'sell',
        'user2',
        'market'
      );

      expect(result.executedQty).to.equal(BigInt('100000000'));
      expect(result.fills).to.have.lengthOf(1);
    });
  });

  describe('Order Cancellation Tests', () => {
    it('should cancel an existing limit order', async () => {
      // Create an order
      const order = engine.createOrder(
        'BTC_USDC',
        '100000000',
        '50000000000',
        'buy',
        'user1',
        'limit'
      );

      // Cancel it
      engine.cancelOrder(order.orderId, 'BTC_USDC', 'client1');

      // Verify order book is empty
      const depth = engine.orderBooks[0].getDepth();
      expect(depth.bids).to.be.empty;
    });
  });

  describe('Balance Management Tests', () => {
    it('should lock funds when creating limit orders', async () => {
      engine.createOrder(
        'BTC_USDC',
        '100000000', // 1 BTC
        '50000000000', // 500 USDC
        'buy',
        'user1',
        'limit'
      );

      const userBalance = engine.balance.get('user1');
      expect(userBalance?.USDC.locked).to.equal(BigInt('50000000000'));
      expect(userBalance?.USDC.available).to.equal(BigInt('950000000000'));
    });

    it('should update balances after trade execution', async () => {
      // Create sell order
      engine.createOrder(
        'BTC_USDC',
        '100000000',
        '50000000000',
        'sell',
        'user1',
        'limit'
      );

      // Create matching buy order
      engine.createOrder(
        'BTC_USDC',
        '100000000',
        '50000000000',
        'buy',
        'user2',
        'limit'
      );

      const seller = engine.balance.get('user1');
      const buyer = engine.balance.get('user2');

      expect(seller?.USDC.available).to.equal(BigInt('1050000000000')); // Got 500 USDC
      expect(buyer?.BTC.available).to.equal(BigInt('100000000')); // Got 1 BTC
    });
  });

  describe('Error Handling Tests', () => {
    it('should reject orders with insufficient balance', async () => {
      expect(() => 
        engine.createOrder(
          'BTC_USDC',
          '100000000000', // 1000 BTC
          '50000000000', // 500 USDC
          'buy',
          'user1',
          'limit'
        )
      ).to.throw('Insufficient USDC balance');
    });

    it('should reject invalid market orders', async () => {
      expect(() => 
        engine.createOrder(
          'INVALID_MARKET',
          '100000000',
          '50000000000',
          'buy',
          'user1',
          'limit'
        )
      ).to.throw('No OrderBook found');
    });
  });
}); 