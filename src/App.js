import axios from 'axios'
import { useState, useEffect } from 'react'
import moment from 'moment'

// calculate distance between each drone to nfz origin point (position 250000, 250000)
//
// to define which drones are violating the NDZ (no drone zone)
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

  return diffInMinutes <= 4
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
        // console.log(
        //   'response.data.report.capture[0]',
        //   response.data.report.capture[0],
        // )

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

        const listWithViolatingDrones = validCaptures?.map((captureObject) => {
          let filteredDroneArr = captureObject.drone.filter((drone) => {
            return isInsideNDZ(
              drone.positionX,
              drone.positionY,
              originX,
              originY,
              Radius,
            )
          }) // filter ends here

          return { ...captureObject, drone: filteredDroneArr }
        }) // map ends here

        // array of distance, use Math.min to fine the closet confirmed distance drone-nest

        // create pilot links for fetching violating pilot info
        // expected output is an arr of link with serialNumber param

        const fetchPilotLinks = listWithViolatingDrones
          ?.map((captureObject) => {
            let serialNumberList = captureObject.drone.map(
              (drone) => drone.serialNumber,
            )

            let pilotLinks = serialNumberList.map(
              (serialNumber) =>
                `http://localhost:3001/api/pilots/${serialNumber}`,
            )
            return pilotLinks
          })
          .reduce(
            (accumulator, currentValue) => accumulator.concat(currentValue),
            [],
          )

        // remove duplicate links out of fetchPilotLinks array
        const pilotLinksWithNoDuplicates = fetchPilotLinks.reduce(
          (accumulator, currentValue) => {
            if (!accumulator.includes(currentValue)) {
              return [...accumulator, currentValue]
            }
            return accumulator
          },
          [],
        )

        console.log(
          'pilotLinksWithNoDuplicates',
          pilotLinksWithNoDuplicates.length,
        )

        // fetch pilots info

        axios
          .all(pilotLinksWithNoDuplicates.map((link) => axios.get(link)))
          .then(
            axios.spread(function (...res) {
              console.log('res', res)
              // setViolatingPilots(res)
              const allPilots = res.reduce(
                (accumulator, currentValue) =>
                  accumulator.concat(currentValue.data),
                [],
              )
              console.log('allPilotsArr', allPilots)
              setViolatingPilots(allPilots)
            }),
          )
        // axios all ends here

        console.log('captureData', captureData.length)
        console.log('validCaptures', validCaptures.length)
        console.log('listWithViolatingDrones', listWithViolatingDrones.length)
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

  if (validCaptures.length === 0) {
    return <p>loading...</p>
  }
  return (
    <div className="App">
      <h1> birdnest app</h1>
      <h3>Pilots whose drones violate NDZ from the last 10 minutes</h3>
      <ol>
        {violatingPilots.map((pilot, index) => (
          <li key={pilot.firstName}>
            <p>
              {' '}
              {pilot.firstName} {pilot.lastName}
            </p>
            <p>phone: {pilot.phoneNumber}</p>
            <p>Email: {pilot.email}</p>
          </li>
        ))}
      </ol>
    </div>
  )
}

export default App
