// @flow
export type LayoutItemRequired = {
  w: number,
  h: number,
  x: number,
  y: number,
  i: string,
};
export type LayoutItem = LayoutItemRequired & {
  minW?: number,
  minH?: number,
  maxW?: number,
  maxH?: number,
  moved?: boolean,
  static?: boolean,
  isDraggable?: ?boolean,
  isResizable?: ?boolean,
};
export type Layout = Array<LayoutItem>;
// export type Position = {left: number, top: number, width: number, height: number};
/*
export type DragCallbackData = {
  node: HTMLElement,
  x: number, y: number,
  deltaX: number, deltaY: number,
  lastX: number, lastY: number
};
*/
// export type DragEvent = {e: Event} & DragCallbackData;
export type Size = { width: number, height: number };
// export type ResizeEvent = {e: Event, node: HTMLElement, size: Size};

// const isProduction = process.env.NODE_ENV === 'production';
/**
 * Return the bottom coordinate of the layout.
 *
 * @param  {Array} layout Layout array.
 * @return {Number}       Bottom coordinate.
 */
export function bottom(layout: Layout): number {
  let max = 0,
    bottomY;
  for (let i = 0, len = layout.length; i < len; i++) {
    bottomY = layout[i].y + layout[i].h;
    if (bottomY > max) max = bottomY;
  }
  return max;
}

export function cloneLayout(layout: Layout): Layout {
  const newLayout = Array(layout.length);
  for (let i = 0, len = layout.length; i < len; i++) {
    newLayout[i] = cloneLayoutItem(layout[i]);
  }
  return newLayout;
}

// Fast path to cloning, since this is monomorphic
export function cloneLayoutItem(layoutItem: LayoutItem): LayoutItem {
  /*return {
    w: layoutItem.w, h: layoutItem.h, x: layoutItem.x, y: layoutItem.y, i: layoutItem.i,
    minW: layoutItem.minW, maxW: layoutItem.maxW, minH: layoutItem.minH, maxH: layoutItem.maxH,
    moved: Boolean(layoutItem.moved), static: Boolean(layoutItem.static),
    // These can be null
    isDraggable: layoutItem.isDraggable, isResizable: layoutItem.isResizable
  };*/
  return JSON.parse(JSON.stringify(layoutItem));
}

/**
 * Given two layoutitems, check if they collide.
 *
 * @return {Boolean}   True if colliding.
 */
export function collides(l1: LayoutItem, l2: LayoutItem): boolean {
  if (l1 === l2) return false; // same element
  if (l1.x + l1.w <= l2.x) return false; // l1 is left of l2
  if (l1.x >= l2.x + l2.w) return false; // l1 is right of l2
  if (l1.y + l1.h <= l2.y) return false; // l1 is above l2
  if (l1.y >= l2.y + l2.h) return false; // l1 is below l2
  return true; // boxes overlap
}

/**
 * Given a layout, compact it. This involves going down each y coordinate and removing gaps
 * between items.
 *
 * @param  {Array} layout Layout.
 * @param  {Boolean} verticalCompact Whether or not to compact the layout
 *   vertically.
 * @return {Array}       Compacted Layout.
 */
export function compact(layout: Layout, verticalCompact: Boolean): Layout {
  // Statics go in the compareWith array right away so items flow around them.
  const compareWith = getStatics(layout);
  // We go through the items by row and column.
  const sorted = sortLayoutItemsByRowCol(layout);
  // Holding for new items.
  const out = Array(layout.length);

  for (let i = 0, len = sorted.length; i < len; i++) {
    let l = sorted[i];

    // Don't move static elements
    if (!l.static) {
      l = compactItem(compareWith, l, verticalCompact);

      // Add to comparison array. We only collide with items before this one.
      // Statics are already in this array.
      compareWith.push(l);
    }

    // Add to output array to make sure they still come out in the right order.
    out[layout.indexOf(l)] = l;

    // Clear moved flag, if it exists.
    l.moved = false;
  }

  return out;
}

/**
 * Compact an item in the layout.
 */
export function compactItem(
  compareWith: Layout,
  l: LayoutItem,
  verticalCompact: boolean
): LayoutItem {
  if (verticalCompact) {
    // Move the element up as far as it can go without colliding.
    while (l.y > 0 && !getFirstCollision(compareWith, l)) {
      l.y < 1 ? (l.y = 0) : l.y--;
    }
  }

  // Move it down, and keep moving it down if it's colliding.
  let collides;
  while ((collides = getFirstCollision(compareWith, l))) {
    l.y = collides.y + collides.h;
  }
  return l;
}

/**
 * Given a layout, make sure all elements fit within its bounds.
 *
 * @param  {Array} layout Layout array.
 * @param  {Number} bounds Number of columns.
 */
export function correctBounds(
  layout: Layout,
  bounds: { cols: number }
): Layout {
  const collidesWith = getStatics(layout);
  for (let i = 0, len = layout.length; i < len; i++) {
    const l = layout[i];
    // Overflows right
    if (l.x + l.w > bounds.cols) l.x = bounds.cols - l.w;
    // Overflows left
    if (l.x < 0) {
      l.x = 0;
      l.w = bounds.cols;
    }
    if (!l.static) collidesWith.push(l);
    else {
      // If this is static and collides with other statics, we must move it down.
      // We have to do something nicer than just letting them overlap.
      while (getFirstCollision(collidesWith, l)) {
        l.y++;
      }
    }
  }
  return layout;
}

/**
 * Get a layout item by ID. Used so we can override later on if necessary.
 *
 * @param  {Array}  layout Layout array.
 * @param  {String} id     ID
 * @return {LayoutItem}    Item at ID.
 */
export function getLayoutItem(layout: Layout, id: string): ?LayoutItem {
  for (let i = 0, len = layout.length; i < len; i++) {
    if (layout[i].i === id) return layout[i];
  }
}

/**
 * Returns the first item this layout collides with.
 * It doesn't appear to matter which order we approach this from, although
 * perhaps that is the wrong thing to do.
 *
 * @param  {Object} layoutItem Layout item.
 * @return {Object|undefined}  A colliding layout item, or undefined.
 */
export function getFirstCollision(
  layout: Layout,
  layoutItem: LayoutItem
): ?LayoutItem {
  for (let i = 0, len = layout.length; i < len; i++) {
    if (collides(layout[i], layoutItem)) return layout[i];
  }
}

export function getAllCollisions(
  layout: Layout,
  layoutItem: LayoutItem
): Array<LayoutItem> {
  return layout.filter((l) => collides(l, layoutItem));
}

/**
 * Get all static elements.
 * @param  {Array} layout Array of layout objects.
 * @return {Array}        Array of static layout items..
 */
export function getStatics(layout: Layout): Array<LayoutItem> {
  //return [];
  return layout.filter((l) => l.static);
}

/**
 * Move an element. Responsible for doing cascading movements of other elements.
 *
 * @param  {Array}      layout Full layout to modify.
 * @param  {LayoutItem} l      element to move.
 * @param  {Number}     [x]    X position in grid units.
 * @param  {Number}     [y]    Y position in grid units.
 * @param  {Boolean}    [isUserAction] If true, designates that the item we're moving is
 *                                     being dragged/resized by th euser.
 */
export function moveElement(
  layout: Layout,
  l: LayoutItem,
  x: Number,
  y: Number,
  isUserAction: Boolean,
  preventCollision: Boolean
): Layout {
  if (l.static) return layout;

  // Short-circuit if nothing to do.
  //if (l.y === y && l.x === x) return layout;

  const oldX = l.x;
  const oldY = l.y;

  const movingUp = y && l.y > y;
  // This is quite a bit faster than extending the object
  if (typeof x === "number") l.x = x;
  if (typeof y === "number") l.y = y;
  l.moved = true;

  // If this collides with anything, move it.
  // When doing this comparison, we have to sort the items we compare with
  // to ensure, in the case of multiple collisions, that we're getting the
  // nearest collision.
  let sorted = sortLayoutItemsByRowCol(layout);
  if (movingUp) sorted = sorted.reverse();
  const collisions = getAllCollisions(sorted, l);

  if (preventCollision && collisions.length) {
    l.x = oldX;
    l.y = oldY;
    l.moved = false;
    return layout;
  }

  // Move each item that collides away from this element.
  for (let i = 0, len = collisions.length; i < len; i++) {
    const collision = collisions[i];
    // console.log('resolving collision between', l.i, 'at', l.y, 'and', collision.i, 'at', collision.y);

    // Short circuit so we can't infinite loop
    if (collision.moved) continue;

    // This makes it feel a bit more precise by waiting to swap for just a bit when moving up.
    if (l.y > collision.y && l.y - collision.y > collision.h / 4) continue;

    // Don't move static items - we have to move *this* element away
    if (collision.static) {
      layout = moveElementAwayFromCollision(layout, collision, l, isUserAction);
    } else {
      layout = moveElementAwayFromCollision(layout, l, collision, isUserAction);
    }
  }

  return layout;
}

/**
 * This is where the magic needs to happen - given a collision, move an element away from the collision.
 * We attempt to move it up if there's room, otherwise it goes below.
 *
 * @param  {Array} layout            Full layout to modify.
 * @param  {LayoutItem} collidesWith Layout item we're colliding with.
 * @param  {LayoutItem} itemToMove   Layout item we're moving.
 * @param  {Boolean} [isUserAction]  If true, designates that the item we're moving is being dragged/resized
 *                                   by the user.
 */
export function moveElementAwayFromCollision(
  layout: Layout,
  collidesWith: LayoutItem,
  itemToMove: LayoutItem,
  isUserAction: ?boolean
): Layout {
  const preventCollision = false; // we're already colliding
  // If there is enough space above the collision to put this element, move it there.
  // We only do this on the main collision as this can get funky in cascades and cause
  // unwanted swapping behavior.
  if (isUserAction) {
    // Make a mock item so we don't modify the item here, only modify in moveElement.
    const fakeItem: LayoutItem = {
      x: itemToMove.x,
      y: itemToMove.y,
      w: itemToMove.w,
      h: itemToMove.h,
      i: "-1",
    };
    fakeItem.y = Math.max(collidesWith.y - itemToMove.h, 0);
    if (!getFirstCollision(layout, fakeItem)) {
      return moveElement(
        layout,
        itemToMove,
        undefined,
        fakeItem.y,
        preventCollision
      );
    }
  }

  // Previously this was optimized to move below the collision directly, but this can cause problems
  // with cascading moves, as an item may actually leapflog a collision and cause a reversal in order.
  return moveElement(
    layout,
    itemToMove,
    undefined,
    itemToMove.y + 1,
    preventCollision
  );
}

/**
 * Helper to convert a number to a percentage string.
 *
 * @param  {Number} num Any number
 * @return {String}     That number as a percentage.
 */
export function perc(num: number): string {
  return num * 100 + "%";
}

export function setTransform(top, left, width, height): Object {
  // Replace unitless items with px
  const translate = "translate3d(" + left + "px," + top + "px, 0)";
  return {
    transform: translate,
    WebkitTransform: translate,
    MozTransform: translate,
    msTransform: translate,
    OTransform: translate,
    width: width + "px",
    height: height + "px",
    position: "absolute",
  };
}
/**
 * Just like the setTransform method, but instead it will return a negative value of right.
 *
 * @param top
 * @param right
 * @param width
 * @param height
 * @returns {{transform: string, WebkitTransform: string, MozTransform: string, msTransform: string, OTransform: string, width: string, height: string, position: string}}
 */
export function setTransformRtl(top, right, width, height): Object {
  // Replace unitless items with px
  const translate = "translate3d(" + right * -1 + "px," + top + "px, 0)";
  return {
    transform: translate,
    WebkitTransform: translate,
    MozTransform: translate,
    msTransform: translate,
    OTransform: translate,
    width: width + "px",
    height: height + "px",
    position: "absolute",
  };
}

export function setTopLeft(top, left, width, height): Object {
  return {
    top: top + "px",
    left: left + "px",
    width: width + "px",
    height: height + "px",
    position: "absolute",
  };
}
/**
 * Just like the setTopLeft method, but instead, it will return a right property instead of left.
 *
 * @param top
 * @param right
 * @param width
 * @param height
 * @returns {{top: string, right: string, width: string, height: string, position: string}}
 */
export function setTopRight(top, right, width, height): Object {
  return {
    top: top + "px",
    right: right + "px",
    width: width + "px",
    height: height + "px",
    position: "absolute",
  };
}

/**
 * Get layout items sorted from top left to right and down.
 *
 * @return {Array} Array of layout objects.
 * @return {Array}        Layout, sorted static items first.
 */
export function sortLayoutItemsByRowCol(layout: Layout): Layout {
  return [].concat(layout).sort(function(a, b) {
    if (a.y > b.y || (a.y === b.y && a.x > b.x)) {
      return 1;
    }
    return -1;
  });
}

/**
 * Generate a layout using the initialLayout and children as a template.
 * Missing entries will be added, extraneous ones will be truncated.
 *
 * @param  {Array}  initialLayout Layout passed in through props.
 * @param  {String} breakpoint    Current responsive breakpoint.
 * @param  {Boolean} verticalCompact Whether or not to compact the layout vertically.
 * @return {Array}                Working layout.
 */
/*
export function synchronizeLayoutWithChildren(initialLayout: Layout, children: Array<React.Element>|React.Element,
                                              cols: number, verticalCompact: boolean): Layout {
  // ensure 'children' is always an array
  if (!Array.isArray(children)) {
    children = [children];
  }
  initialLayout = initialLayout || [];

  // Generate one layout item per child.
  let layout: Layout = [];
  for (let i = 0, len = children.length; i < len; i++) {
    let newItem;
    const child = children[i];

    // Don't overwrite if it already exists.
    const exists = getLayoutItem(initialLayout, child.key || "1" /!* FIXME satisfies Flow *!/);
    if (exists) {
      newItem = exists;
    } else {
      const g = child.props._grid;

      // Hey, this item has a _grid property, use it.
      if (g) {
        if (!isProduction) {
          validateLayout([g], 'ReactGridLayout.children');
        }
        // Validated; add it to the layout. Bottom 'y' possible is the bottom of the layout.
        // This allows you to do nice stuff like specify {y: Infinity}
        if (verticalCompact) {
          newItem = cloneLayoutItem({...g, y: Math.min(bottom(layout), g.y), i: child.key});
        } else {
          newItem = cloneLayoutItem({...g, y: g.y, i: child.key});
        }
      }
      // Nothing provided: ensure this is added to the bottom
      else {
        newItem = cloneLayoutItem({w: 1, h: 1, x: 0, y: bottom(layout), i: child.key || "1"});
      }
    }
    layout[i] = newItem;
  }

  // Correct the layout.
  layout = correctBounds(layout, {cols: cols});
  layout = compact(layout, verticalCompact);

  return layout;
}
*/

/**
 * Validate a layout. Throws errors.
 *
 * @param  {Array}  layout        Array of layout items.
 * @param  {String} [contextName] Context name for errors.
 * @throw  {Error}                Validation error.
 */
export function validateLayout(layout: Layout, contextName: string): void {
  contextName = contextName || "Layout";
  const subProps = ["x", "y", "w", "h"];
  if (!Array.isArray(layout))
    throw new Error(contextName + " must be an array!");
  for (let i = 0, len = layout.length; i < len; i++) {
    const item = layout[i];
    for (let j = 0; j < subProps.length; j++) {
      if (typeof item[subProps[j]] !== "number") {
        throw new Error(
          "VueGridLayout: " +
            contextName +
            "[" +
            i +
            "]." +
            subProps[j] +
            " must be a number!"
        );
      }
    }
    if (item.i && typeof item.i !== "string") {
      // number is also ok, so comment the error
      // TODO confirm if commenting the line below doesn't cause unexpected problems
      // throw new Error('VueGridLayout: ' + contextName + '[' + i + '].i must be a string!');
    }
    if (item.static !== undefined && typeof item.static !== "boolean") {
      throw new Error(
        "VueGridLayout: " +
          contextName +
          "[" +
          i +
          "].static must be a boolean!"
      );
    }
  }
}

// Flow can't really figure this out, so we just use Object
export function autoBindHandlers(el: Object, fns: Array<string>): void {
  fns.forEach((key) => (el[key] = el[key].bind(el)));
}

/**
 * Convert a JS object to CSS string. Similar to React's output of CSS.
 * @param obj
 * @returns {string}
 */
export function createMarkup(obj) {
  var keys = Object.keys(obj);
  if (!keys.length) return "";
  var i,
    len = keys.length;
  var result = "";

  for (i = 0; i < len; i++) {
    var key = keys[i];
    var val = obj[key];
    result += hyphenate(key) + ":" + addPx(key, val) + ";";
  }

  return result;
}

/* The following list is defined in React's core */
export var IS_UNITLESS = {
  animationIterationCount: true,
  boxFlex: true,
  boxFlexGroup: true,
  boxOrdinalGroup: true,
  columnCount: true,
  flex: true,
  flexGrow: true,
  flexPositive: true,
  flexShrink: true,
  flexNegative: true,
  flexOrder: true,
  gridRow: true,
  gridColumn: true,
  fontWeight: true,
  lineClamp: true,
  lineHeight: true,
  opacity: true,
  order: true,
  orphans: true,
  tabSize: true,
  widows: true,
  zIndex: true,
  zoom: true,

  // SVG-related properties
  fillOpacity: true,
  stopOpacity: true,
  strokeDashoffset: true,
  strokeOpacity: true,
  strokeWidth: true,
};

/**
 * Will add px to the end of style values which are Numbers.
 * @param name
 * @param value
 * @returns {*}
 */
export function addPx(name, value) {
  if (typeof value === "number" && !IS_UNITLESS[name]) {
    return value + "px";
  } else {
    return value;
  }
}

/**
 * Hyphenate a camelCase string.
 *
 * @param {String} str
 * @return {String}
 */

export var hyphenateRE = /([a-z\d])([A-Z])/g;

export function hyphenate(str) {
  return str.replace(hyphenateRE, "$1-$2").toLowerCase();
}

export function findItemInArray(array, property, value) {
  for (var i = 0; i < array.length; i++)
    if (array[i][property] == value) return true;

  return false;
}

export function findAndRemove(array, property, value) {
  array.forEach(function(result, index) {
    if (result[property] === value) {
      //Remove from array
      array.splice(index, 1);
    }
  });
}

/**
 * 交换l1(dragItem),l2(dropItem)位置
 */
function exchangeLayout(layout, l1, l2) {
  const l1Idx = layout.findIndex((item) => item.i === l1.i);
  const l2Idx = layout.findIndex((item) => item.i === l2.i);
  // 水平方向大小不同的换位
  if (l2.x > l1.x) {
    layout[l1Idx] = { ...l1, x: l2.x + (l2.w - l1.w), y: l2.y };
    layout[l2Idx] = { ...l2, x: l1.x, y: l1.y };
  } else {
    layout[l1Idx] = { ...l1, x: l2.x, y: l2.y };
    layout[l2Idx] = { ...l2, x: l1.x + (l1.w - l2.w), y: l1.y };
  }
  return layout;
}

/**
 * dragItem拖拽后上下左右平分dropItem
 * l1(dragItem),l2(dropItem)
 * TODO w,h为奇数如3 5 7等特殊处理
 */
function SplitDropItem(layout, l1, l2, pos) {
  const l1Idx = layout.findIndex((item) => item.i === l1.i);
  const l2Idx = layout.findIndex((item) => item.i === l2.i);
  const { x, y, w, h } = l2;
  const centerX = x + w / 2;
  const centerY = y + h / 2;
  switch (pos) {
    case "top":
      layout[l1Idx] = { ...l1, x, y, w, h: h / 2 };
      layout[l2Idx] = { ...l2, y: centerY, h: h / 2 };
      break;
    case "bottom":
      layout[l1Idx] = {
        ...l1,
        x,
        y: centerY,
        w,
        h: h / 2,
      };
      layout[l2Idx] = { ...l2, h: h / 2 };
      break;
    case "left":
      layout[l1Idx] = {
        ...l1,
        x,
        y,
        w: w / 2,
        h,
      };
      layout[l2Idx] = { ...l2, w: w / 2, x: centerX };
      break;
    case "right":
      layout[l1Idx] = {
        ...l1,
        x: centerX,
        y,
        w: w / 2,
        h,
      };
      layout[l2Idx] = { ...l2, w: w / 2 };
      break;
  }
  return layout;
}

/**
 * 比较两个l的边是否完全重合
 */
function borderFit(l1, l2) {
  if (l1 === l2) return false; // same element
  // border-top
  if (l1.y === l2.y + l2.h && l1.w === l2.w && l1.x === l2.x) return true;
  // border-bottom
  if (l1.y + l1.h === l2.y && l1.w === l2.w && l1.x === l2.x) return true;
  // border-left
  if (l1.x === l2.x + l2.w && l1.h === l2.h && l1.y === l2.y) return true;
  // border-right
  if (l1.x + l1.w === l2.x && l1.h === l2.h && l1.y === l2.y) return true;
}

export function judgeDragPostion({ w, h, x, y, l, l1 }) {
  /**
   * @target 判断当前鼠标在drop块的哪个区域（大小形状完全一致上下左右中，不一致上下左右）
   * @desc1 当前四边形x,y方向各三等分分出上下左右四个梯形和中间一个四边形，坐标系在左下角 两条对角线y=(h/w)*x,y= h - (h/w)*x
   * @desc2 对角线切割，分成4个等腰三角形，坐标系在左下角 两条对角线y=(h/w)*x,y= h - (h/w)*x
   */

  // 大小完全一样 || 相邻且边等长贴合
  if ((w === l.w && h === l.h) || borderFit(l, l1)) {
    // 上下左右中
    // 左1/3区域
    if (x < w / 3) {
      if (y <= (h / w) * x) {
        return "bottom";
      }
      if (y >= h - (h / w) * x) {
        return "top";
      }
      return "left";
    }
    // 中1/3区域
    if (x >= w / 3 && x <= (w * 2) / 3) {
      if (y <= h / 3) {
        return "bottom";
      }
      if (y >= (h * 2) / 3) {
        return "top";
      }
      return "center";
    }

    // 右1/3区域
    if (x > (w * 2) / 3) {
      if (y >= (h / w) * x) {
        return "top";
      }
      if (y <= h - (h / w) * x) {
        return "bottom";
      }
      return "right";
    }
  }

  //大小不一样 上下左右
  if (y <= (h / w) * x) {
    // 下、右
    if (y >= h - (h / w) * x) {
      return "right";
    } else {
      return "bottom";
    }
  } else {
    if (y >= h - (h / w) * x) {
      return "top";
    } else {
      return "left";
    }
  }
}

function getPlaceholderPostion(pos, dropItem) {
  let x, y, w, h;
  switch (pos) {
    case "center":
      x = dropItem.x;
      y = dropItem.y;
      w = dropItem.w;
      h = dropItem.h;
      break;
    case "top":
      x = dropItem.x;
      y = dropItem.y;
      w = dropItem.w;
      h = dropItem.h / 2;
      break;
    case "bottom":
      x = dropItem.x;
      y = dropItem.y + dropItem.h / 2;
      w = dropItem.w;
      h = dropItem.h / 2;
      break;
    case "left":
      x = dropItem.x;
      y = dropItem.y;
      w = dropItem.w / 2;
      h = dropItem.h;
      break;
    case "right":
      x = dropItem.x + dropItem.w / 2;
      y = dropItem.y;
      w = dropItem.w / 2;
      h = dropItem.h;
      break;
    default:
      return undefined;
  }
  return {
    x,
    y,
    w,
    h,
    i: dropItem.i,
    dropItem,
    pos,
  };
}

function handlerBoundaryContions(pos, w, h) {
  if (w > 1 && h > 1) {
    return pos;
  } else if (w > 1 && h < 2) {
    if (!["top", "bottom"].includes(pos)) return pos;
  } else if (h > 1 && w < 2) {
    if (!["left", "right"].includes(pos)) return pos;
  } else {
    if (pos === "center") return pos;
  }
}

export function getMousePlaceholder(layout, mousePos, l) {
  for (let idx = 0, len = layout.length; idx < len; idx++) {
    let { x, y, w, h, i } = layout[idx];
    let { x: x1, y: y1 } = mousePos;
    if (x1 >= x && x1 <= x + w && y1 >= y && y1 <= y + h) {
      let delX = x1 - x;
      let delY = h - (y1 - y);
      if (l.i !== i) {
        const pos = judgeDragPostion({
          w,
          h,
          x: delX,
          y: delY,
          l,
          l1: layout[idx],
        });
        return getPlaceholderPostion(
          handlerBoundaryContions(pos, w, h),
          layout[idx]
        );
      }
      // eslint-disable-next-line no-unreachable
      break;
    }
  }
}

// 获取和当前块边完全对齐的块，可能是一个也可以是多个
// TODO寻找最小面积块-复杂度高暂不做
function getAlignItems(layout, l) {
  // l（当前移动中的块）的边
  const borders = ["bottom", "top", "left", "right"];
  let resItems = [];
  for (let index = 0, len = borders.length; index < len; index++) {
    const type = borders[index];
    if (type === "bottom") {
      const items = layout
        .filter(
          (item) =>
            item.y === l.y + l.h &&
            item.x >= l.x &&
            item.x + item.w <= l.x + l.w
        )
        .sort((a, b) => a.x - b.x);
      if (items.length) {
        const firstItem = items[0];
        const lastItem = items[items.length - 1];
        if (firstItem.x === l.x && lastItem.x + lastItem.w === l.x + l.w) {
          resItems = items.map((item) => ({
            i: item.i,
            y: -1 * l.h,
            h: l.h,
          }));
          break;
        }
      }
    }
    if (type === "top") {
      const items = layout
        .filter(
          (item) =>
            l.y === item.y + item.h &&
            item.x >= l.x &&
            item.x + item.w <= l.x + l.w
        )
        .sort((a, b) => a.x - b.x);
      if (items.length) {
        const firstItem = items[0];
        const lastItem = items[items.length - 1];
        if (firstItem.x === l.x && lastItem.x + lastItem.w === l.x + l.w) {
          resItems = items.map((item) => ({ i: item.i, h: l.h }));
          break;
        }
      }
    }
    if (type === "left") {
      const items = layout
        .filter(
          (item) =>
            l.x === item.x + item.w &&
            item.y >= l.y &&
            item.y + item.h <= l.y + l.h
        )
        .sort((a, b) => a.y - b.y);
      if (items.length) {
        const firstItem = items[0];
        const lastItem = items[items.length - 1];
        if (firstItem.y === l.y && lastItem.y + lastItem.h === l.y + l.h) {
          resItems = items.map((item) => ({ i: item.i, w: l.w }));
          break;
        }
      }
    }
    if (type === "right") {
      const items = layout
        .filter(
          (item) =>
            item.x === l.x + l.w &&
            item.y >= l.y &&
            item.y + item.h <= l.y + l.h
        )
        .sort((a, b) => a.y - b.y);
      if (items.length) {
        const firstItem = items[0];
        const lastItem = items[items.length - 1];
        if (firstItem.y === l.y && lastItem.y + lastItem.h === l.y + l.h) {
          resItems = items.map((item) => ({
            i: item.i,
            x: -1 * l.w,
            w: l.w,
          }));
          break;
        }
      }
    }
  }
  return resItems;
}

// fillGap
function fillGap(layout, changeList) {
  console.log(changeList);
  changeList.map(({ i, x = 0, y = 0, h = 0, w = 0 } = {}) => {
    const index = layout.findIndex((l) => l.i === i);
    layout[index] = {
      ...layout[index],
      x: layout[index].x + x,
      y: layout[index].y + y,
      w: layout[index].w + w,
      h: layout[index].h + h,
    };
  });
}

// dropElement
export function dropElement(layout, l, mousePlaceholder) {
  if (!mousePlaceholder) return layout;
  let copyLayout = cloneLayout(layout);
  switch (mousePlaceholder.pos) {
    case "center":
      // 换位
      exchangeLayout(copyLayout, l, mousePlaceholder.dropItem);
      break;
    default:
      // left、right、top、bottom
      // 贴合块填补空位
      fillGap(copyLayout, getAlignItems(layout, l));
      SplitDropItem(
        copyLayout,
        l,
        mousePlaceholder.dropItem,
        mousePlaceholder.pos
      );
      break;
  }
  return copyLayout;
}
