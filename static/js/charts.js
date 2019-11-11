function donutChart(selector, data, title, dimension = 200) {
  var width = dimension
      height = dimension
      margin = 40

  var radius = Math.min(width, height) / 2 - margin
  var svg = d3.select(selector)
    .append("svg")
      .attr("width", width)
      .attr("height", height)
    .append("g")
      .attr("transform", "translate(" + width / 2 + "," + height / 2 + ")");

  var pie = d3.pie().value(function(d) {return d.value; })
  var data_ready = pie(d3.entries(data))

  svg
    .selectAll('all')
    .data(data_ready)
    .enter()
    .append('path')
    .attr('d', d3.arc()
      .innerRadius(dimension / 2.5)
      .outerRadius(radius)
    )
    .attr('x-key', function (d) {
      return d.data.key;
    })
    .style("opacity", 0.7)

  if (title) {
    svg.append("text")
      .attr("class", "chart-title")
      .attr("text-anchor", "middle")
      .text(title);
  }

  return svg;
}

function buildStatsChart(selector, data, dimension) {
  var svg = donutChart(selector, data, null, dimension);
  
  var total = Object.keys(data).reduce((count, curr) => {
    count += data[curr];
    return count;
  }, 0);

  svg
    .append("text")
    .attr("class", "count")
    .attr("text-anchor", "middle")
    .attr("style", "font-size:23px")
    .text(total);

  svg
    .append("text")
    .attr("transform", "translate(0, 20)")
    .attr("class", "count-label")
    .attr("text-anchor", "middle")
    .attr("style", "font-size:10px")
    .text("Builds last 24h");
}