// Licence: Robert Koch-Institut (RKI), dl-de/by-2-0

// Thanks to @rphl (https://github.com/rphl) and @tzschies (https://github.com/tzschies) for their inspiring work on this widget. See https://gist.github.com/rphl/0491c5f9cb345bf831248732374c4ef5 and https://gist.github.com/tzschies/563fab70b37609bc8f2f630d566bcbc9.

class IncidenceWidget {

  constructor() {
    this.previousDaysToShow = 7;
    this.sevenDay = 7;
    this.apiUrlDistricts = (location) => `https://services7.arcgis.com/mOBPykOjAyBO2ZKk/arcgis/rest/services/RKI_Landkreisdaten/FeatureServer/0/query?where=1%3D1&outFields=EWZ,RS,GEN,cases7_bl_per_100k,cases7_per_100k,BL&geometry=${location.longitude.toFixed(3)}%2C${location.latitude.toFixed(3)}&geometryType=esriGeometryPoint&inSR=4326&spatialRel=esriSpatialRelWithin&returnGeometry=false&outSR=4326&f=json`
    // where=IdLandkreis = '${districtId}' AND Meldedatum >= TIMESTAMP '${this.getDateString(-this.previousDaysToShow)} 00:00:00' AND Meldedatum <= TIMESTAMP '${this.getDateString(1)} 00:00:00 AND Refdatum >= TIMESTAMP '${this.getDateString(-this.previousDaysToShow)} 00:00:00' AND Refdatum <= TIMESTAMP '${this.getDateString(1)} 00:00:00' AND IstErkrankungsbeginn = 1
    this.apiUrlDistrictsHistory = (districtId) => `https://services7.arcgis.com/mOBPykOjAyBO2ZKk/arcgis/rest/services/RKI_COVID19/FeatureServer/0/query?where=IdLandkreis%20%3D%20%27${districtId}%27%20AND%20Meldedatum%20%3E%3D%20TIMESTAMP%20%27${this.getDateString(-this.previousDaysToShow)}%2000%3A00%3A00%27%20AND%20Meldedatum%20%3C%3D%20TIMESTAMP%20%27${this.getDateString(1)}%2000%3A00%3A00%27%20AND%20Refdatum%20%3E%3D%20TIMESTAMP%20%27${this.getDateString(-this.previousDaysToShow)}%2000%3A00%3A00%27%20AND%20Refdatum%20%3C%3D%20TIMESTAMP%20%27${this.getDateString(1)}%2000%3A00%3A00%27%20AND%20IstErkrankungsbeginn%20%3D%201&outFields=Landkreis,Meldedatum,AnzahlFall,RefDatum,IstErkrankungsbeginn&outSR=4326&f=json`
    this.stateToAbbr = {
      'Baden-Württemberg': 'BW',
      'Bayern': 'BY',
      'Berlin': 'BE',
      'Brandenburg': 'BB',
      'Bremen': 'HB',
      'Hamburg': 'HH',
      'Hessen': 'HE',
      'Mecklenburg-Vorpommern': 'MV',
      'Niedersachsen': 'NI',
      'Nordrhein-Westfalen': 'NRW',
      'Rheinland-Pfalz': 'RP',
      'Saarland': 'SL',
      'Sachsen': 'SN',
      'Sachsen-Anhalt': 'ST',
      'Schleswig-Holstein': 'SH',
      'Thüringen': 'TH'
    };
  }

  async run() {
    let widget = await this.createWidget()
    if (!config.runsInWidget) {
      await widget.presentSmall()
    }
    Script.setWidget(widget)
    Script.complete()
  }

  async createWidget(items) {
    let data = await this.getData()

    // Basic widget setup
    let list = new ListWidget()
    list.setPadding(0, 0, 0, 0)
    let textStack = list.addStack()
    textStack.setPadding(14, 14, 0, 14)
    textStack.layoutVertically()
    textStack.topAlignContent()

    // Header
    let header = textStack.addText("🦠 Inzidenz".toUpperCase())
    header.font = Font.mediumSystemFont(13)
    textStack.addSpacer()

    if (data.error) {
      // Error handling
      let loadingIndicator = textStack.addText(data.error.toUpperCase())
      textStack.setPadding(14, 14, 14, 14)
      loadingIndicator.font = Font.mediumSystemFont(13)
      loadingIndicator.textOpacity = 0.5
      let spacer = textStack.addStack()
      spacer.addSpacer();
    } else {
      // Enable caching
      list.refreshAfterDate = new Date(Date.now() + 60 * 60 * 1000)

      // Main stack for value and area name
      let incidenceStack = textStack.addStack()
      let valueStack = incidenceStack.addStack()
      incidenceStack.layoutVertically()
      let incidenceValueLabel = valueStack.addText(data.incidence + data.trend)
      incidenceValueLabel.font = Font.boldSystemFont(24)
      incidenceValueLabel.textColor = data.incidence >= 100 ? new Color("9e000a") : data.incidence >= 50 ? Color.red() : data.incidence >= 35 ? Color.yellow() : Color.green();
      incidenceStack.addText(data.areaName)

      // Chip for displaying state data
      valueStack.addSpacer(4)
      let stateStack = valueStack.addStack()
      let stateText = stateStack.addText(data.incidenceBySide + "\n" + data.areaNameBySide)
      stateStack.backgroundColor = new Color('888888', .5)
      stateStack.cornerRadius = 4
      stateStack.setPadding(2, 4, 2, 4)
      stateText.font = Font.mediumSystemFont(9)
      stateText.textColor = Color.white()
      valueStack.addSpacer()

      // Chart
      let chart = new LineChart(400, 120, data.timeline).configure((ctx, path) => {
        ctx.opaque = false;
        ctx.setFillColor(new Color("888888", .25));
        ctx.addPath(path);
        ctx.fillPath(path);
      }).getImage();
      let chartStack = list.addStack()
      chartStack.setPadding(0, 0, 0, 0)
      let img = chartStack.addImage(chart)
      img.applyFittingContentMode()
    }
    return list
  }

  async getData() {
    try {
      let location = await this.getLocation()
      if (location) {
        let currentData = await new Request(this.apiUrlDistricts(location)).loadJSON();
        Helper.log("CurrentData:", currentData);
        let attr = currentData.features[0].attributes;
        //Helper.log("Attributes:", attr);
        let historicalData = await new Request(this.apiUrlDistrictsHistory(attr.RS)).loadJSON();
        //Helper.log("HistoricalData:", historicalData);
        let aggregate = historicalData.features.map(f => f.attributes).reduce((dict, feature) => {
          dict[feature["Refdatum"]] = (dict[feature["Refdatum"]] | dict[feature["Meldedatum"]] | 0) + feature["AnzahlFall"] + feature["IstErkrankungsbeginn"];
          return dict;
        }, {});
        //Helper.log("Aggregate:", aggregate);
        let timeline = Object.keys(aggregate).sort().map(k => aggregate[k]);
        let casesYesterday7 = timeline.slice(-8, -1).reduce(this.sum);
        let casesToday7 = timeline.slice(-7).reduce(this.sum);
        let trend = (casesToday7 == casesYesterday7) ? '→' : (casesToday7 > casesYesterday7) ? '↑' : '↓';
        return {
          incidence: attr.cases7_per_100k.toFixed(0),
          areaName: attr.GEN,
          trend: trend,
          incidenceBySide: attr.cases7_bl_per_100k.toFixed(0),
          areaNameBySide: this.stateToAbbr[attr.BL],
          timeline: timeline
        };
      }
      return {
        error: "Standort nicht verfügbar."
      }
    } catch (e) {
      return {
        error: "Fehler bei Datenabruf."
      };
    }
  }

  getDateString(addDays) {
    addDays = addDays || 0;
    return new Date(Date.now() + addDays * 24 * 60 * 60 * 1000).toISOString().substring(0, 10)
  }

  async getLocation() {
    try {
      if (args.widgetParameter) {
        let fixedCoordinates = args.widgetParameter.split(",").map(parseFloat)
        return {
          latitude: fixedCoordinates[0],
          longitude: fixedCoordinates[1]
        }
      } else {
        Location.setAccuracyToThreeKilometers()
        return await Location.current()
      }
    } catch (e) {
      return null;
    }
  }

  sum(a, b) {
    return a + b;
  }

}

class LineChart {

  constructor(width, height, values) {
    this.ctx = new DrawContext()
    this.ctx.size = new Size(width, height)
    this.values = values;
  }

  _calculatePath() {
    let maxValue = Math.max(...this.values);
    let minValue = Math.min(...this.values);
    let difference = maxValue - minValue;
    let count = this.values.length;
    let step = this.ctx.size.width / (count - 1);
    let points = this.values.map((current, index, all) => {
      let x = step * index
      let y = this.ctx.size.height - (current - minValue) / difference * this.ctx.size.height;
      return new Point(x, y)
    });
    return this._getSmoothPath(points);
  }

  _getSmoothPath(points) {
    let path = new Path()
    path.move(new Point(0, this.ctx.size.height));
    path.addLine(points[0]);
    for (var i = 0; i < points.length - 1; i++) {
      let xAvg = (points[i].x + points[i + 1].x) / 2;
      let yAvg = (points[i].y + points[i + 1].y) / 2;
      let avg = new Point(xAvg, yAvg);
      let cp1 = new Point((xAvg + points[i].x) / 2, points[i].y);
      let next = new Point(points[i + 1].x, points[i + 1].y);
      let cp2 = new Point((xAvg + points[i + 1].x) / 2, points[i + 1].y);
      path.addQuadCurve(avg, cp1);
      path.addQuadCurve(next, cp2);
    }
    path.addLine(new Point(this.ctx.size.width, this.ctx.size.height))
    path.closeSubpath()
    return path;
  }

  configure(fn) {
    let path = this._calculatePath()
    if (fn) {
      fn(this.ctx, path);
    } else {
      this.ctx.addPath(path);
      this.ctx.fillPath(path);
    }
    return this.ctx;
  }

}

class Helper {
  static log(...data) {
    console.log(data.map(JSON.stringify).join(' | '))
  }
}

await new IncidenceWidget().run();