var app = app || {};

app.Block = Backbone.Model.extend({

  defaults: {
    x: 0,
    y: 0
  },

  initialize: function () {
    var shape = this.get('shape');
    this.set('width', shape[0].length);
    this.set('height', shape.length);
  }

});

app.Board = Backbone.Collection.extend({

  model: app.Block

});

app.BlockView = Backbone.View.extend({

  initialize: function () {
    var self = this;
    this.render();
    this.model.on('change', _.bind(this.render, this));
  },

  render: function () {
    this.clearCanvas();
    var self = this;
    var shape = this.model.get('shape');
    var x_pos = this.model.get('x') * app.blockSize;
    var y_pos = this.model.get('y') * app.blockSize;
    for (var y = 0; y < shape.length; y++) {
      var row = shape[y];
      for (var x = 0; x < row.length; x++) {
        if (row[x] == 1) {
          self.stamp(x_pos + (x * app.blockSize), y_pos + (y * app.blockSize));
        }
      }
    }
    app.events.trigger('blockRendered');
    return this;
  },

  clearCanvas: function () {
    app.context.clearRect(0, 0, app.canvas.width, app.canvas.height);

  },

  stamp: function (x, y) {
    app.context.beginPath();
    app.context.rect(x, y, app.blockSize, app.blockSize);
    app.context.lineWidth = 1;
    app.context.strokeStyle = 'white';
    app.context.stroke();
  }

});

app.BoardView = Backbone.View.extend({

  el: $('canvas'),

  paused: false,

  muted: false,

  gameOver: false,

  /* Initialize board view */
  initialize: function () {
    gridView = new app.GridView();
    if (!app.logging) {
      var gridWidth = $('#gridContainer').width();
      var boardWidth = $('#board').width();
      $('#gridContainer').hide();
      $('#board').width(boardWidth - gridWidth - 60);
    }
    this.collection = new app.Board(app.Block);
    gridView.clearGrid();
    gridView.logGrid();
    $(document).on('keydown', $.proxy(this.keyAction, this));
    app.events.on('pause', this.pause, this);
    app.events.on('mute', this.mute, this);
    app.events.on('blockRendered', gridView.drawGrid, this);
    this.start();
  },

  /* Setting the interval for the game to run. */
  start: function () {
    var self = this;
    clearInterval(app.interval);
    app.interval = setInterval(function () {
      self.descend();
      self.render();
    }, 800);
  },

  /* Iterating through the collection and creating a new BlockView for each model in the collection. */
  render: function () {
    this.collection.each(function (model) {
      var blockView = new app.BlockView({
        model: model
      });
    }, this);
  },

  /* The below code is updating the grid, checking if the game is over, checking if there are any
  complete rows, clearing the collection, and spawning a new block. */
  blockLanded: function (block) {
    this.updateGrid();
    this.checkGameOver(block);
    this.checkCompleteRows();
    this.clearCollection();
    this.spawnNewBlock();
  },

  /* Clear colletion of current block */
  clearCollection: function () {
    this.collection.reset();
  },

  /* Create a new block at random and add to collection */
  spawnNewBlock: function () {
    var shapePos = _.random(app.shapes.length - 1);
    this.collection.add([app.shapes[shapePos]]);
  },

  /* Dispatch key commands */
  keyAction: function (e) {
    var code = e.keyCode || e.which;
    if (!this.paused) {
      if (code == 37) {
        this.moveLeft();
      } else if (code == 39) {
        this.moveRight();
      } else if (code == 40) {
        this.moveDown();
      } else if (code == 38) {
        this.rotate();
      }
    }
    if (code == 80) {
      this.pause();
    }
    if (code == 77) {
      this.mute();
    }
  },

  /* Pause or unpause game */
  pause: function () {
    this.paused = !this.paused;
    if (this.paused) {
      $('#pause').html('Unpause (p)');
      $('#message').html('Paused.')
      $('#message').show();
      clearInterval(app.interval);
    } else {
      $('#pause').html('Pause (p)');
      $('#message').html('');
      $('#message').hide();
      this.start();
    }
  },

  /* Toggle mute */
  mute: function () {
    this.muted = !this.muted;
    if (this.muted) {
      $('#mute').html('Unmute (m)');
    } else {
      $('#mute').html('Mute (m)');
    }
  },

  /* Add a landed block to the underlying grid */
  updateGrid: function () {
    this.collection.each(function (model) {
      gridView.updateGrid(model)
      gridView.logGrid();
    }, this);
  },

  checkGameOver: function (block) {
    var blockY = block.get('y');
    if (blockY <= 0) {
      this.gameOver();
    }
  },

  /* This is the game over function. It is called when the game is over. It draws the grid, plays the
  game over audio, clears the interval, and displays the game over message. */
  gameOver: function () {
    gridView.drawGrid();
    this.playAudio('gameOver');
    clearInterval(app.interval);
    $('#message').html('GAME OVER!')
    $('#message').show();
  },

  /* Creating a new audio object and playing it. */
  playAudio: function (key) {
    if (!this.muted) {
      var player = new Audio();
      player.src = jsfxr(app.sounds[key]);
      player.play();
    }
  },

  /* Checking if there are any complete rows. */
  checkCompleteRows: function () {
    var completeRows = [];
    for (var y = 0; y < app.grid.length; y++) {
      var row = app.grid[y];
      var complete = true;
      for (var x = 0; x < row.length; x++) {
        if (row[x] != 1) {
          complete = false;
        }
      }
      if (complete) {
        completeRows.push(y);
      }
    }
    if (completeRows.length > 0) {
      this.clearCompleteRows(completeRows);
    } else {
      this.playAudio('land');
    }
  },

  /* Clear any complete rows from the grid and add a new clean row to the top */
  clearCompleteRows: function (completeRows) {
    this.playAudio('completeRow');
    for (var i = 0; i < completeRows.length; i++) {
      var rowIndex = completeRows[i];
      app.grid.splice(rowIndex, 1);
      var row = [];
      for (var x = 0; x < app.width; x++) {
        row.push(0);
      }
      app.grid.unshift(row);
    }
    gridView.logGrid();
  },

  /* Move a block left on keyboard input */
  moveLeft: function () {
    var self = this;
    this.collection.each(function (model) {
      var newX = model.get('x') - 1;
      if (model.get('x') > 0 && self.shapeFits(model.get('shape'), newX, model.get('y'))) {
        model.set('x', newX);
        self.playAudio('bluhp');
      }
    });
  },

  /* Move a block right on keyboard input */
  moveRight: function () {
    var self = this;
    this.collection.each(function (model) {
      var newX = model.get('x') + 1;
      if (model.get('x') + model.get('width') < app.width && self.shapeFits(model.get('shape'), newX, model.get('y'))) {
        model.set('x', newX);
        self.playAudio('bluhp');
      }
    });
  },

  /* Move a block down on keyboard input */
  moveDown: function () {
    var self = this;
    this.collection.each(function (model) {
      var newY = model.get('y') + 1;
      if (model.get('y') + model.get('height') < app.height && self.shapeFits(model.get('shape'), model.get('x'), newY)) {
        model.set('y', newY);
        self.playAudio('bluhp');
      }
    });
  },

  /* Automatically move a block down one step */
  descend: function () {
    var self = this;
    this.collection.each(function (model) {
      if (model.get('y') + model.get('height') < app.height && self.shapeFits(model.get('shape'), model.get('x'), model.get('y') + 1)) {
        model.set('y', model.get('y') + 1);
      } else {
        self.blockLanded(model);
      }
    });
  },

  /* Check if a given shape is within the bounds of the play area */
  shapeWithinBounds: function (shape, x, y) {
    if (x < 0) {
      return false;
    }
    if (x + shape[0].length > app.width) {
      return false;
    }
    return true;
  },

  /* Check if a shape fits in the play area and with the other blocks */
  rotatedShapeFits: function (shape, x, y) {
    return this.shapeFits(shape, x, y) && this.shapeWithinBounds(shape, x, y);
  },

  /* Rotating the shape. */
  rotate: function () {
    var self = this;
    this.collection.each(function (model) {
      var transposed = _.zip.apply(_, model.get('shape'));
      var reversed = transposed.reverse();
      if (self.rotatedShapeFits(reversed, model.get('x'), model.get('y'))) {
        model.set('shape', reversed);
        var shape = model.get('shape');
        model.set('width', shape[0].length);
        model.set('height', shape.length);
        self.playAudio('bluhp');
      }
    });
  },

  /* Check if a block collides with landed blocks */
  shapeFits: function (shape, shapeX, shapeY) {
    for (var y = 0; y < shape.length; y++) {
      var row = shape[y];
      for (var x = 0; x < row.length; x++) {
        if (row[x] == 1) {
          var checkX = shapeX + x;
          var checkY = shapeY + y;
          if (app.grid[checkY][checkX] == 1) {
            return false;
          }
        }
      }
    }
    return true;
  }
});

/* Creating a new view for the controls. */
app.ControlsView = Backbone.View.extend({

  el: $('#controls'),

  events: {
    'click #pause': 'pause',
    'click #mute': 'mute',
  },

  pause: function () {
    app.events.trigger('pause');
  },

  mute: function () {
    app.events.trigger('mute');
  }

});

app.GridView = Backbone.View.extend({

  /* Add a landed block to the underlying grid */
  updateGrid: function (model) {
    var shape = model.get('shape');
    var x = model.get('x');
    var y = model.get('y');
    /* Placing the shape on the grid. */
    for (var shape_y = 0; shape_y < shape.length; shape_y++) {
      var row = shape[shape_y];
      for (var shape_x = 0; shape_x < row.length; shape_x++) {
        if (row[shape_x] == 1) {
          app.grid[y + shape_y][x + shape_x] = 1;
        }
      }
    }
  },

  /* Draw any blocks (landed) from the underlying grid */
  drawGrid: function () {
    for (var y = 0; y < app.grid.length; y++) {
      var row = app.grid[y];
      for (var x = 0; x < row.length; x++) {
        if (row[x] == 1) {
          var x_pos = x * app.blockSize;
          var y_pos = y * app.blockSize;
          app.context.fillStyle = '#FFFFFF';
          app.context.fillRect(x_pos, y_pos, app.blockSize, app.blockSize);
        }
      }
    }
  },

  /* Reset the underlying grid to 0 */
  clearGrid: function () {
    app.grid = [];
    for (var y = 0; y < app.height; y++) {
      var row = [];
      for (var x = 0; x < app.width; x++) {
        row.push(0);
      }
      app.grid.push(row);
    }
  },

  /* Print out the underlying grid */
  logGrid: function () {
    if (app.logging) {
      var html = '';
      for (var y = 0; y < app.grid.length; y++) {
        var row = app.grid[y];
        var str = 'y: ' + String('00' + y).slice(-2) + ' | ';
        for (var x = 0; x < row.length; x++) {
          str += '<span class="grid';
          if (row[x] == 0) {
            str += 'Off';
          } else {
            str += 'On';
          }
          str += '">';
          str += row[x] + ' ';
          str += '</span>';
        }
        str += '<br>';
        html += str;
      }
      $('.grid').html(html);
    }
  }
});

app.boot = function () {

  app.canvas = document.querySelector("canvas");

  app.context = app.canvas.getContext("2d");

  app.context.shadowColor = 'white';

  app.context.shadowBlur = 15;

  app.blockSize = 20;

  app.logging = true;

  app.width = app.canvas.width / app.blockSize;

  app.height = app.canvas.height / app.blockSize;

  app.events = _.extend({}, Backbone.Events);

  app.sounds = {
    'bluhp': [2, 0.01, 0.13, 0.49, 0.33, 0.31, 0.06, 0.02, -0.9, 0.05, 0.51, 0.08, 0.08, 0.1062, 0.491, 0.12, -0.64, -0.5566, 0.68, -0.5, 0.24, 0.29, 0.12, 0.3],
    'land': [2, , 0.103, , 0.3933, 0.4497, 0.0299, 0.0561, -0.0534, 0.4388, 0.0143, -0.3671, 0.2831, 0.8169, -0.133, 0.7848, -0.0841, -0.5874, 0.9552, -0.129, 0.4723, 0.1745, -0.0226, 0.2],
    'completeRow': [0, 0.0007, 0.3015, 0.5485, 0.39, 0.5029, , 0.7037, 0.3194, , , 0.665, 0.228, 0.3467, 0.05, 0.5698, -0.1913, -0.0563, 0.3286, -0.0055, , 0.4958, 0.0814, 0.5],
    'gameOver': [2, 0.0009, 0.41, 0.0873, 0.6029, 0.36, , -0.0999, -0.0799, , -0.4843, -0.0152, , -0.617, -0.0004, -0.6454, -0.12, 0.4399, 0.59, 0.1799, 0.21, 0.15, -0.24, 0.5]
  };

  app.pointsPerLine = {
    1: 40,
    2: 100,
    3: 300,
    4: 1200
  };

  app.shapes = [{
    shape: [
      [0, 1, 0],
      [1, 1, 1]
    ]
  }, {
    shape: [
      [0, 1, 1],
      [1, 1, 0]
    ]
  }, {
    shape: [
      [1, 1, 0],
      [0, 1, 1]
    ]
  }, {
    shape: [
      [1],
      [1],
      [1],
      [1]
    ]
  },
  {
    shape: [
      [1, 1, 1, 1]
    ]
  }, {
    shape: [
      [1, 1],
      [1, 1]
    ]
  }, {
    shape: [
      [1, 1],
      [1, 0],
      [1, 0]
    ]
  }, {
    shape: [
      [1, 1],
      [0, 1],
      [0, 1]
    ]
  },];

  var shapePos = _.random(app.shapes.length - 1);
  app.Block = [app.shapes[shapePos]];

  app.BoardView = new app.BoardView();

  // Controls:
  new app.ControlsView();

}

$(function () {
  app.boot()
});