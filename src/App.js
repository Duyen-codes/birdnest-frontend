import axios from 'axios'
import { useState, useEffect } from 'react'
import moment from 'moment'

function isInsideNDZ(droneX, droneY, originX, originY, Radius) {
  const d =
    Radius -
    Math.sqrt(
      (droneX - originX) * (droneX - originX) +
        (droneY - originY) * (droneY - originY),
    )

  return d <= 0
}

// check time validity

const isTimeValid = (snapshotTimestamp) => {
  let today = new Date()
  // console.log('today', today)
  let snapshotDate = new Date(snapshotTimestamp)
  let diff = today.getTime() - snapshotDate.getTime()
  // console.log('diff', diff)
  let diffInMinutes = Math.round(diff / 60000)
  // console.log('diffInMinutes', diffInMinutes)
  return diffInMinutes <= 3
}

function App() {
  const [captureData, setCaptureData] = useState([])
  const [violatingPilots, setViolatingPilots] = useState([])

  const Radius = 100
  const originX = 250000
  const originY = 250000

  useEffect(() => {
    console.log('useEffect running')
    let interval = setInterval(() => {
      axios.get('http://localhost:3001/api/drones').then((response) => {
        console.log(
          'response.data.report.capture[0]',
          response.data.report.capture[0],
        )

        setCaptureData(captureData.concat(response.data.report.capture[0]))
        // console.log('captureData', captureData)

        // filter out captureData that is valid (from the last 10 minutes)

        // filter the captureData array which is an arr of capture objects{snapshotTimestamp, drone} to get new arr of captures with only violating drones

        const listWithViolatingDrones = captureData?.map((captureObject) => {
          console.log(
            'captureObject.drone.length before filter',
            captureObject.drone.length,
          )

          let filteredDroneArr = captureObject.drone.filter((drone) => {
            return isInsideNDZ(
              drone.positionX,
              drone.positionY,
              originX,
              originY,
              Radius,
            )
          }) // filter ends here
          console.log('filteredDroneArr.length', filteredDroneArr.length)

          return { ...captureObject, drone: filteredDroneArr }

          console.log('before return map')
        }) // map ends here

        console.log('listWithViolatingDrones', listWithViolatingDrones)

        const snapshotTimestamp = listWithViolatingDrones[0]?.snapshotTimestamp
        console.log('snapshotTimestamp', snapshotTimestamp)
        let snapshotDate = new Date(snapshotTimestamp)

        console.log('snapshotDate', snapshotDate)

        let dateTimeAgo = moment(snapshotDate).fromNow()
        console.log('dateTimeAgo', dateTimeAgo)

        let today = new Date()

        let diff = today.getTime() - snapshotDate.getTime()
        console.log('diff', diff)
        let diffInMinutes = Math.round(diff / 60000)
        console.log('diffInMinutes', diffInMinutes)

        // create pilot links for fetching

        // const fetchPilotLinks = violatingDrones?.map((drone) => {
        //   return `http://localhost:3001/api/pilots/${drone.serialNumber}`
        // })

        // fetch pilots info

        // axios.all(fetchPilotLinks.map((link) => axios.get(link))).then(
        //   axios.spread(function (...res) {
        //     console.log('res', res)
        //     setViolatingPilots(res)
        //   }),
        // )
        // axios all ends here
      })
    }, 5000)

    return () => {
      clearInterval(interval)
    }
  }, [violatingPilots])

  // calculate distance between each drone to nfz origin point (position 250000, 250000)
  //
  // to define which drones are violating the nfz

  function droneToNestDistance(droneX, droneY) {
    return Math.sqrt(
      (droneX - originX) * (droneX - originX) +
        (droneY - originY) * (droneY - originY),
    )
  }

  console.log('rerendering...')
  console.log('captureData', captureData)

  let validCaptures = captureData.filter((capture) => {
    let result = isTimeValid(capture.snapshotTimestamp)

    if (result) {
      return capture
    }
  })

  console.log('validCaptures.length', validCaptures.length)

  return (
    <div className="App">
      <h1> birdnest app</h1>
      <h3>Pilots whose drones violate NDZ in the last 10m</h3>
      <ol>
        {validCaptures.map((capture, index) => (
          <li key={index}>{capture.snapshotTimestamp}</li>
        ))}
      </ol>
    </div>
  )
}

export default App
