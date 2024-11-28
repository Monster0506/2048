class Game2048 {
    constructor() {
        this.gridSize = 4;
        this.gridContainer = document.querySelector('.grid-container');
        this.score = 0;
        this.bestScore = parseInt(localStorage.getItem('bestScore')) || 0;
        this.mergedTiles = new Set();
        this.isAIPlaying = false;
        this.aiDelay = 300; // Increased delay between moves
        this.searchDepth = 5; // Depth for minimax search
        this.hasWon = false;
        this.gameOver = false;
        this.updateScore();
        this.setupGrid();
        this.setupNewGameButton();
        this.setupAIButton();
        this.setupVictoryModal();
        this.setupGameOverModal();
        this.setupKeyboardControls();
        this.initializeGame();
    }

    setupGrid() {
        // Calculate tile size based on container width
        const containerWidth = this.gridContainer.clientWidth;
        const tileSize = (containerWidth - (this.gridSize + 1) * 15) / this.gridSize;
        
        // Create grid cells
        for (let i = 0; i < this.gridSize * this.gridSize; i++) {
            const cell = document.createElement('div');
            cell.className = 'grid-cell';
            this.gridContainer.appendChild(cell);
        }

        // Set grid container style
        this.gridContainer.style.width = containerWidth + 'px';
        this.gridContainer.style.height = containerWidth + 'px';

        // Initialize grid array
        this.grid = Array(this.gridSize).fill().map(() => Array(this.gridSize).fill(0));
        this.tiles = new Map(); // Store tile elements
    }

    setupNewGameButton() {
        document.getElementById('new-game').addEventListener('click', () => {
            this.initializeGame();
        });
    }

    setupAIButton() {
        const aiButton = document.getElementById('ai-play');
        aiButton.addEventListener('click', () => {
            this.isAIPlaying = !this.isAIPlaying;
            aiButton.textContent = this.isAIPlaying ? 'Stop AI' : 'Let AI Play';
            aiButton.classList.toggle('playing', this.isAIPlaying);
            if (this.isAIPlaying) {
                this.makeAIMove();
            }
        });
    }

    setupVictoryModal() {
        const modal = document.getElementById('victory-modal');
        const keepPlayingBtn = document.getElementById('keep-playing');
        const newGameBtn = document.getElementById('new-game-victory');

        keepPlayingBtn.addEventListener('click', () => {
            modal.classList.remove('show');
            this.hasWon = true; // Prevent showing modal again
        });

        newGameBtn.addEventListener('click', () => {
            modal.classList.remove('show');
            this.initializeGame();
        });
    }

    setupGameOverModal() {
        const modal = document.getElementById('gameover-modal');
        const newGameBtn = document.getElementById('new-game-loss');

        newGameBtn.addEventListener('click', () => {
            modal.classList.remove('show');
            this.initializeGame();
        });
    }

    setupKeyboardControls() {
        document.addEventListener('keydown', (e) => {
            if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
                e.preventDefault();
                this.move(e.key);
            }
        });
    }

    initializeGame() {
        // Clear grid and tiles
        this.grid = Array(this.gridSize).fill().map(() => Array(this.gridSize).fill(0));
        this.tiles.forEach(tile => tile.remove());
        this.tiles.clear();
        this.score = 0;
        this.hasWon = false;
        this.gameOver = false;
        this.updateScore();

        // Add initial tiles
        this.addNewTile();
        this.addNewTile();
    }

    updateScore() {
        document.getElementById('score').textContent = this.score;
        document.getElementById('best-score').textContent = this.bestScore;
    }

    addNewTile() {
        const emptyCells = [];
        for (let i = 0; i < this.gridSize; i++) {
            for (let j = 0; j < this.gridSize; j++) {
                if (this.grid[i][j] === 0) {
                    emptyCells.push({ x: i, y: j });
                }
            }
        }

        if (emptyCells.length > 0) {
            const { x, y } = emptyCells[Math.floor(Math.random() * emptyCells.length)];
            const value = Math.random() < 0.9 ? 2 : 4;
            this.grid[x][y] = value;
            this.createTileElement(x, y, value, true);
        }
    }

    createTileElement(x, y, value, isNew = false) {
        const tile = document.createElement('div');
        tile.className = `tile tile-${value}${isNew ? ' new' : ''}`;
        tile.textContent = value;
        this.positionTile(tile, x, y);
        this.gridContainer.appendChild(tile);
        this.tiles.set(`${x}-${y}`, tile);
    }

    positionTile(tile, x, y) {
        const containerWidth = this.gridContainer.clientWidth;
        const cellSize = (containerWidth - (this.gridSize - 1) * 15) / this.gridSize;
        tile.style.width = cellSize + 'px';
        tile.style.height = cellSize + 'px';
        tile.style.left = (y * (cellSize + 15)) + 'px';
        tile.style.top = (x * (cellSize + 15)) + 'px';
    }

    move(direction) {
        if (this.gameOver) return;

        let moved = false;
        const directionVectors = {
            'ArrowUp': { x: -1, y: 0 },
            'ArrowDown': { x: 1, y: 0 },
            'ArrowLeft': { x: 0, y: -1 },
            'ArrowRight': { x: 0, y: 1 }
        };

        const vector = directionVectors[direction];
        const traversals = this.buildTraversals(vector);

        // Clear merged flags
        this.mergedTiles = new Set();

        traversals.x.forEach(x => {
            traversals.y.forEach(y => {
                const cell = { x, y };
                const tile = this.grid[x][y];

                if (tile !== 0) {
                    const positions = this.findFarthestPosition(cell, vector);
                    const next = positions.next;

                    if (this.withinBounds(next) && 
                        this.grid[next.x][next.y] === tile && 
                        !this.mergedTiles.has(`${next.x}-${next.y}`)) {
                        // Merge tiles
                        const newValue = tile * 2;
                        this.grid[next.x][next.y] = newValue;
                        this.grid[x][y] = 0;
                        
                        // Check for victory
                        if (newValue === 2048 && !this.hasWon) {
                            setTimeout(() => this.showVictoryModal(), 300);
                        }

                        // Mark as merged
                        this.mergedTiles.add(`${next.x}-${next.y}`);
                        
                        // Update score
                        this.score += newValue;
                        if (this.score > this.bestScore) {
                            this.bestScore = this.score;
                            localStorage.setItem('bestScore', this.bestScore);
                        }
                        this.updateScore();

                        // Update tiles
                        const currentTile = this.tiles.get(`${x}-${y}`);
                        const mergeTile = this.tiles.get(`${next.x}-${next.y}`);
                        if (currentTile && mergeTile) {
                            this.moveTileElement(currentTile, next.x, next.y);
                            setTimeout(() => {
                                currentTile.remove();
                                mergeTile.remove();
                                this.createTileElement(next.x, next.y, newValue);
                            }, 150);
                            this.tiles.delete(`${x}-${y}`);
                            this.tiles.delete(`${next.x}-${next.y}`);
                        }
                        moved = true;
                    } else if (positions.farthest.x !== x || positions.farthest.y !== y) {
                        // Move tile
                        this.grid[positions.farthest.x][positions.farthest.y] = tile;
                        this.grid[x][y] = 0;
                        const currentTile = this.tiles.get(`${x}-${y}`);
                        if (currentTile) {
                            this.moveTileElement(currentTile, positions.farthest.x, positions.farthest.y);
                            this.tiles.delete(`${x}-${y}`);
                            this.tiles.set(`${positions.farthest.x}-${positions.farthest.y}`, currentTile);
                        }
                        moved = true;
                    }
                }
            });
        });

        if (moved) {
            this.addNewTile();
            if (this.isGameOver()) {
                this.gameOver = true;
                setTimeout(() => this.showGameOverModal(), 300);
            }
        }
    }

    buildTraversals(vector) {
        const traversals = { x: [], y: [] };
        for (let i = 0; i < this.gridSize; i++) {
            traversals.x.push(i);
            traversals.y.push(i);
        }

        // Reverse the traversal order based on the direction
        if (vector.x === 1) traversals.x.reverse();
        if (vector.y === 1) traversals.y.reverse();

        return traversals;
    }

    findFarthestPosition(cell, vector) {
        let previous;
        let current = { ...cell };

        do {
            previous = { ...current };
            current = {
                x: previous.x + vector.x,
                y: previous.y + vector.y
            };
        } while (this.withinBounds(current) && this.grid[current.x][current.y] === 0);

        return {
            farthest: previous,
            next: current
        };
    }

    withinBounds(position) {
        return position.x >= 0 && position.x < this.gridSize &&
               position.y >= 0 && position.y < this.gridSize;
    }

    moveTileElement(tile, newX, newY) {
        this.positionTile(tile, newX, newY);
    }

    isGameOver() {
        // Check for empty cells
        for (let x = 0; x < this.gridSize; x++) {
            for (let y = 0; y < this.gridSize; y++) {
                if (this.grid[x][y] === 0) return false;
            }
        }

        // Check for possible merges
        for (let x = 0; x < this.gridSize; x++) {
            for (let y = 0; y < this.gridSize; y++) {
                const currentValue = this.grid[x][y];
                const neighbors = [
                    { x: x + 1, y },
                    { x: x - 1, y },
                    { x, y: y + 1 },
                    { x, y: y - 1 }
                ];

                for (const neighbor of neighbors) {
                    if (this.withinBounds(neighbor) &&
                        this.grid[neighbor.x][neighbor.y] === currentValue) {
                        return false;
                    }
                }
            }
        }

        return true;
    }

    async makeAIMove() {
        while (this.isAIPlaying && !this.isGameOver()) {
            const move = this.findBestMove();
            if (move) {
                this.move(move);
                await new Promise(resolve => setTimeout(resolve, this.aiDelay));
            } else {
                this.isAIPlaying = false;
                const aiButton = document.getElementById('ai-play');
                aiButton.textContent = 'Let AI Play';
                aiButton.classList.remove('playing');
                break;
            }
        }
    }

    findBestMove() {
        const directions = ['ArrowUp', 'ArrowRight', 'ArrowDown', 'ArrowLeft'];
        let bestScore = -Infinity;
        let bestMove = null;

        // Try each move and evaluate using minimax
        for (const direction of directions) {
            const gridCopy = this.grid.map(row => [...row]);
            const result = this.simulateMove(direction, gridCopy);
            
            if (result.moved) {
                // Add a random tile for simulation
                const score = this.minimaxWithChance(result.grid, this.searchDepth, false);
                if (score > bestScore) {
                    bestScore = score;
                    bestMove = direction;
                }
            }
        }

        return bestMove;
    }

    minimaxWithChance(grid, depth, maximizingPlayer) {
        if (depth === 0) {
            return this.evaluatePosition(grid);
        }

        if (maximizingPlayer) {
            let maxScore = -Infinity;
            const directions = ['ArrowUp', 'ArrowRight', 'ArrowDown', 'ArrowLeft'];
            
            for (const direction of directions) {
                const gridCopy = grid.map(row => [...row]);
                const result = this.simulateMove(direction, gridCopy);
                
                if (result.moved) {
                    const score = this.minimaxWithChance(result.grid, depth - 1, false);
                    maxScore = Math.max(maxScore, score);
                }
            }
            
            return maxScore === -Infinity ? this.evaluatePosition(grid) : maxScore;
        } else {
            // Chance node: simulate random tile spawns
            let totalScore = 0;
            let emptyCells = [];
            
            // Find empty cells
            for (let i = 0; i < this.gridSize; i++) {
                for (let j = 0; j < this.gridSize; j++) {
                    if (grid[i][j] === 0) {
                        emptyCells.push({x: i, y: j});
                    }
                }
            }
            
            if (emptyCells.length === 0) {
                return this.evaluatePosition(grid);
            }

            // Sample a subset of empty cells for performance
            const sampleSize = Math.min(3, emptyCells.length);
            const sampledCells = this.sampleCells(emptyCells, sampleSize);
            
            // Try both 2 and 4 tiles in sampled positions
            for (const cell of sampledCells) {
                for (const value of [2, 4]) {
                    const gridCopy = grid.map(row => [...row]);
                    gridCopy[cell.x][cell.y] = value;
                    const probability = value === 2 ? 0.9 : 0.1;
                    totalScore += probability * this.minimaxWithChance(gridCopy, depth - 1, true);
                }
            }
            
            return totalScore / (sampledCells.length * 2);
        }
    }

    sampleCells(cells, size) {
        const shuffled = [...cells];
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        return shuffled.slice(0, size);
    }

    simulateMove(direction, grid) {
        const vectors = {
            'ArrowUp': { x: -1, y: 0 },
            'ArrowDown': { x: 1, y: 0 },
            'ArrowLeft': { x: 0, y: -1 },
            'ArrowRight': { x: 0, y: 1 }
        };

        const vector = vectors[direction];
        let moved = false;
        const mergedPositions = new Set();

        // Build traversals
        const traversals = { x: [], y: [] };
        for (let i = 0; i < this.gridSize; i++) {
            traversals.x.push(i);
            traversals.y.push(i);
        }

        if (vector.x === 1) traversals.x.reverse();
        if (vector.y === 1) traversals.y.reverse();

        // Move tiles
        traversals.x.forEach(x => {
            traversals.y.forEach(y => {
                const value = grid[x][y];
                if (value === 0) return;

                let newX = x;
                let newY = y;

                // Find the farthest position
                while (true) {
                    const nextX = newX + vector.x;
                    const nextY = newY + vector.y;

                    if (nextX < 0 || nextX >= this.gridSize || 
                        nextY < 0 || nextY >= this.gridSize) break;

                    if (grid[nextX][nextY] === 0) {
                        newX = nextX;
                        newY = nextY;
                        moved = true;
                    } else if (grid[nextX][nextY] === value && 
                             !mergedPositions.has(`${nextX}-${nextY}`)) {
                        newX = nextX;
                        newY = nextY;
                        moved = true;
                        mergedPositions.add(`${newX}-${newY}`);
                        break;
                    } else {
                        break;
                    }
                }

                if (newX !== x || newY !== y) {
                    if (grid[newX][newY] === value) {
                        grid[newX][newY] *= 2;
                    } else {
                        grid[newX][newY] = value;
                    }
                    grid[x][y] = 0;
                }
            });
        });

        return { moved, grid };
    }

    evaluatePosition(grid) {
        let score = 0;
        const weights = {
            monotonicity: 1.0,
            smoothness: 0.3,
            maxValue: 2.0,
            emptyTiles: 3.0,
            cornerMax: 2.5,
            pattern: 1.5,
            mergeAvailable: 1.0
        };

        // Monotonicity: prefer larger values in corners and edges
        let monotonicityScore = 0;
        const cornerWeights = [
            [4.0, 3.0, 2.0, 1.0],
            [3.0, 2.0, 1.0, 0.5],
            [2.0, 1.0, 0.5, 0.25],
            [1.0, 0.5, 0.25, 0.1]
        ];

        for (let i = 0; i < this.gridSize; i++) {
            for (let j = 0; j < this.gridSize; j++) {
                if (grid[i][j] !== 0) {
                    monotonicityScore += grid[i][j] * cornerWeights[i][j];
                }
            }
        }

        // Smoothness: prefer tiles with similar values next to each other
        let smoothnessScore = 0;
        for (let i = 0; i < this.gridSize; i++) {
            for (let j = 0; j < this.gridSize; j++) {
                if (grid[i][j] !== 0) {
                    const value = Math.log2(grid[i][j]);
                    // Check horizontal neighbor
                    if (j < this.gridSize - 1 && grid[i][j + 1] !== 0) {
                        smoothnessScore -= Math.abs(value - Math.log2(grid[i][j + 1]));
                    }
                    // Check vertical neighbor
                    if (i < this.gridSize - 1 && grid[i + 1][j] !== 0) {
                        smoothnessScore -= Math.abs(value - Math.log2(grid[i + 1][j]));
                    }
                }
            }
        }

        // Maximum tile value and position
        const maxValue = Math.max(...grid.flat());
        let cornerMax = 0;
        const corners = [{x: 0, y: 0}, {x: 0, y: 3}, {x: 3, y: 0}, {x: 3, y: 3}];
        for (const corner of corners) {
            if (grid[corner.x][corner.y] === maxValue) {
                cornerMax = maxValue;
                break;
            }
        }

        // Number of empty tiles
        const emptyTiles = grid.flat().filter(x => x === 0).length;

        // Snake pattern bonus (zigzag pattern from top-left to bottom-right)
        let patternScore = 0;
        let shouldDecrease = false;
        for (let i = 0; i < this.gridSize; i++) {
            const row = shouldDecrease ? [...grid[i]].reverse() : grid[i];
            for (let j = 0; j < this.gridSize - 1; j++) {
                if (row[j] > row[j + 1]) {
                    patternScore += Math.log2(row[j]);
                }
            }
            shouldDecrease = !shouldDecrease;
        }

        // Available merges
        let mergeScore = 0;
        for (let i = 0; i < this.gridSize; i++) {
            for (let j = 0; j < this.gridSize; j++) {
                if (grid[i][j] !== 0) {
                    // Check right and down for possible merges
                    if (j < this.gridSize - 1 && grid[i][j] === grid[i][j + 1]) mergeScore++;
                    if (i < this.gridSize - 1 && grid[i][j] === grid[i + 1][j]) mergeScore++;
                }
            }
        }

        score += weights.monotonicity * monotonicityScore;
        score += weights.smoothness * smoothnessScore;
        score += weights.maxValue * Math.log2(maxValue);
        score += weights.emptyTiles * Math.pow(emptyTiles, 1.5);
        score += weights.cornerMax * (cornerMax ? Math.log2(cornerMax) : 0);
        score += weights.pattern * patternScore;
        score += weights.mergeAvailable * mergeScore;

        return score;
    }

    showVictoryModal() {
        const modal = document.getElementById('victory-modal');
        modal.classList.add('show');
    }

    showGameOverModal() {
        if (this.isAIPlaying) {
            this.isAIPlaying = false;
            const aiButton = document.getElementById('ai-play');
            aiButton.textContent = 'Let AI Play';
            aiButton.classList.remove('playing');
        }

        const modal = document.getElementById('gameover-modal');
        document.getElementById('final-score').textContent = this.score;
        document.getElementById('final-best-score').textContent = this.bestScore;
        modal.classList.add('show');
    }
}

// Start the game when the page loads
window.addEventListener('load', () => {
    new Game2048();
});
