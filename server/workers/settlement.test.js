/**
 * Test cases for the advanced settlement optimization algorithm
 * Run with: node settlement.test.js
 */

// Mock functions for testing (copy from balanceWorker.js)

function generateSettlementSuggestions(balances) {
  const debtors = [];
  const creditors = [];
  
  Object.entries(balances).forEach(([userId, balance]) => {
    if (balance < -0.01) {
      debtors.push({ userId, amount: Math.abs(balance) });
    } else if (balance > 0.01) {
      creditors.push({ userId, amount: balance });
    }
  });

  debtors.sort((a, b) => b.amount - a.amount);
  creditors.sort((a, b) => b.amount - a.amount);

  const suggestions = [];
  let i = 0;
  let j = 0;

  while (i < debtors.length && j < creditors.length) {
    const debtor = debtors[i];
    const creditor = creditors[j];

    const settleAmount = Math.min(debtor.amount, creditor.amount);

    if (settleAmount > 0.01) {
      suggestions.push({
        from: debtor.userId,
        to: creditor.userId,
        amount: Math.round(settleAmount * 100) / 100,
      });
    }

    debtor.amount = Math.round((debtor.amount - settleAmount) * 100) / 100;
    creditor.amount = Math.round((creditor.amount - settleAmount) * 100) / 100;

    if (debtor.amount < 0.01) i++;
    if (creditor.amount < 0.01) j++;
  }

  const optimizedSuggestions = optimizeSettlementGraph(suggestions, balances);
  return optimizedSuggestions;
}

function optimizeSettlementGraph(suggestions, balances) {
  const graph = {};
  const users = Object.keys(balances);
  
  users.forEach(userId => {
    graph[userId] = [];
  });
  
  suggestions.forEach(({ from, to, amount }) => {
    graph[from].push({ to, amount });
  });

  const simplified = [];
  
  suggestions.forEach(transaction => {
    const { from, to, amount } = transaction;
    const reverseAmount = findReversePathAmount(graph, to, from);
    
    if (reverseAmount > 0 && reverseAmount < amount) {
      const reducedAmount = amount - reverseAmount;
      if (reducedAmount > 0.01) {
        simplified.push({
          from,
          to,
          amount: Math.round(reducedAmount * 100) / 100,
        });
      }
    } else if (reverseAmount === 0) {
      simplified.push(transaction);
    }
  });

  const consolidated = consolidateTransactions(simplified);
  
  return consolidated.length > 0 ? consolidated : suggestions;
}

function findReversePathAmount(graph, source, target) {
  if (!graph[source]) return 0;
  
  const visited = new Set();
  const queue = [{ node: source, minAmount: Infinity }];
  visited.add(source);
  
  while (queue.length > 0) {
    const { node, minAmount } = queue.shift();
    
    if (node === target) {
      return minAmount;
    }
    
    if (graph[node]) {
      for (const edge of graph[node]) {
        if (!visited.has(edge.to)) {
          visited.add(edge.to);
          queue.push({
            node: edge.to,
            minAmount: Math.min(minAmount, edge.amount),
          });
        }
      }
    }
  }
  
  return 0;
}

function consolidateTransactions(transactions) {
  const map = new Map();
  
  transactions.forEach(({ from, to, amount }) => {
    const key = `${from}→${to}`;
    const existing = map.get(key) || 0;
    map.set(key, existing + amount);
  });
  
  return Array.from(map.entries()).map(([key, amount]) => {
    const [from, to] = key.split('→');
    return {
      from,
      to,
      amount: Math.round(amount * 100) / 100,
    };
  });
}

// ========== TEST CASES ==========

console.log('🧪 Settlement Optimization Algorithm Tests\n');

// Test 1: Simple 3-person group
console.log('Test 1: Simple 3-person group (no cycles)');
const test1Balances = {
  'alice': 100,  // paid 100
  'bob': -50,    // owes 50
  'charlie': -50 // owes 50
};
const test1Result = generateSettlementSuggestions(test1Balances);
console.log('Balances:', test1Balances);
console.log('Result:', test1Result);
console.log('Transactions:', test1Result.length, '\n');

// Test 2: Triangle cycle (A→B, B→C, C→A)
console.log('Test 2: Triangle cycle (should be reduced)');
const test2Balances = {
  'alice': 100,   // owes 100 to charlie
  'bob': 100,     // owes 100 to alice
  'charlie': -200 // owed 100 by bob, paid 100 to bob
};
const test2Result = generateSettlementSuggestions(test2Balances);
console.log('Balances:', test2Balances);
console.log('Result:', test2Result);
console.log('Transactions:', test2Result.length, '\n');

// Test 3: Complex group with multiple people
console.log('Test 3: Complex 5-person group');
const test3Balances = {
  'alice': 150,   // paid 150
  'bob': 100,     // paid 100
  'charlie': -100, // owes 100
  'diana': -75,   // owes 75
  'eve': -75      // owes 75
};
const test3Result = generateSettlementSuggestions(test3Balances);
console.log('Balances:', test3Balances);
console.log('Result:', test3Result);
console.log('Transactions:', test3Result.length, '\n');

// Test 4: Equal split among 4 people (everyone pays equal share)
console.log('Test 4: Equal split among 4 people');
const test4Balances = {
  'user1': 100,   // paid 100, owes 25
  'user2': -75,   // owes 75
  'user3': -25,   // owes 25
  'user4': 0      // balanced
};
const test4Result = generateSettlementSuggestions(test4Balances);
console.log('Balances:', test4Balances);
console.log('Result:', test4Result);
console.log('Transactions:', test4Result.length, '\n');

// Test 5: Cycle detection - partial offset
console.log('Test 5: Partial cycle offset');
const test5Balances = {
  'alice': 100,     // paid 100, owes 30 to charlie
  'bob': -50,       // owes 50
  'charlie': -50    // owed 30 by alice, paid 20
};
const test5Result = generateSettlementSuggestions(test5Balances);
console.log('Balances:', test5Balances);
console.log('Result:', test5Result);
console.log('Transactions:', test5Result.length, '\n');

// Test 6: Zero balance user
console.log('Test 6: Group with balanced member');
const test6Balances = {
  'alice': 100,
  'bob': 0,
  'charlie': -100
};
const test6Result = generateSettlementSuggestions(test6Balances);
console.log('Balances:', test6Balances);
console.log('Result:', test6Result);
console.log('Transactions:', test6Result.length, '\n');

// Verification function
function verifyResult(balances, suggestions) {
  const verify = { ...balances };
  
  suggestions.forEach(({ from, to, amount }) => {
    verify[from] += amount;  // They pay, so add to their balance
    verify[to] -= amount;    // Receiver receives, so subtract from their balance
  });
  
  const allZero = Object.values(verify).every(v => Math.abs(v) < 0.01);
  return allZero;
}

console.log('✅ Verification:');
[test1Result, test2Result, test3Result, test4Result, test5Result, test6Result].forEach((result, idx) => {
  const balances = [test1Balances, test2Balances, test3Balances, test4Balances, test5Balances, test6Balances][idx];
  const isValid = verifyResult(balances, result);
  console.log(`Test ${idx + 1}: ${isValid ? '✓ Valid' : '✗ Invalid'}`);
});

console.log('\n✨ All tests completed!');
