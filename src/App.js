import axios from 'axios'
import { useState, useEffect } from 'react'
import moment from 'moment'

// calculate distance between each drone to nfz origin point (position 250000, 250000)
//
// to define which drones are violating the nfz
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

const isTimeValid = (today, snapshotTimestamp) => {
  // console.log('today', today)
  let snapshotDate = new Date(snapshotTimestamp)
  let diff = today.getTime() - snapshotDate.getTime()
  // console.log('diff', diff)
  let diffInMinutes = Math.ceil(diff / 60000)
  // console.log('diffInMinutes', diffInMinutes)
  return diffInMinutes <= 10
}

const momentAgo = (snapshotTimestamp) => {
  const snapshotDate = new Date(snapshotTimestamp)

  return moment(snapshotDate).fromNow()
}

function App() {
  const [captureData, setCaptureData] = useState([])
  const [validCaptures, setValidCaptures] = useState([])
  const [violatingPilots, setViolatingPilots] = useState([])

  const Radius = 100
  const originX = 250000
  const originY = 250000
  const today = new Date()
  console.log('App rendering...')

  useEffect(() => {
    console.log('useEffect running')
    let interval = setInterval(() => {
      axios.get('http://localhost:3001/api/drones').then((response) => {
        console.log(
          'response.data.report.capture[0]',
          response.data.report.capture[0],
        )

        setCaptureData(captureData.concat(response.data.report.capture[0]))

        // filter out captureData that is valid (from the last 10 minutes)
        let validCaptures = captureData.filter((capture) => {
          let result = isTimeValid(today, capture?.snapshotTimestamp)

          if (result) {
            return capture
          }
        })
        setValidCaptures(validCaptures)
        // filter the captureData array which is an arr of capture objects{snapshotTimestamp, drone} to get new arr of captures with only violating drones

        const listWithViolatingDrones = captureData?.map((captureObject) => {
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
        }) // map ends here

        console.log('listWithViolatingDrones', listWithViolatingDrones)

        // create pilot links for fetching violating pilot info

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
  }, [captureData])

  function droneToNestDistance(droneX, droneY) {
    return Math.sqrt(
      (droneX - originX) * (droneX - originX) +
        (droneY - originY) * (droneY - originY),
    )
  }

  console.log('captureData', captureData)
  console.log('validCaptures', validCaptures)

  console.log('validCaptures.length', validCaptures.length)
  if (!validCaptures) {
    return <p>loading...</p>
  }
  return (
    <div className="App">
      <h1> birdnest app</h1>
      <h3>Pilots whose drones violate NDZ from the last 10 minutes</h3>
      <ol>
        {validCaptures.map((capture, index) => (
          <li key={index}>
            {capture.snapshotTimestamp}
            <p>Captured {momentAgo(capture.snapshotTimestamp)}</p>
          </li>
        ))}
      </ol>
    </div>
  )
}

export default App
