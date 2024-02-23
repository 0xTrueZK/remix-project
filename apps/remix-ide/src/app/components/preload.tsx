import {RemixApp} from '@remix-ui/app'
import axios from 'axios'
import React, {useEffect, useRef, useState} from 'react'
import * as packageJson from '../../../../../package.json'
import {fileSystem, fileSystems} from '../files/fileSystem'
import {indexedDBFileSystem} from '../files/filesystems/indexedDB'
import {localStorageFS} from '../files/filesystems/localStorage'
import {fileSystemUtility, migrationTestData} from '../files/filesystems/fileSystemUtility'
import './styles/preload.css'
import isElectron from 'is-electron'
const _paq = (window._paq = window._paq || [])

export const Preload = (props: any) => {
  const [tip, setTip] = useState<string>('')
  const [supported, setSupported] = useState<boolean>(true)
  const [error, setError] = useState<boolean>(false)
  const [showDownloader, setShowDownloader] = useState<boolean>(false)
  const remixFileSystems = useRef<fileSystems>(new fileSystems())
  const remixIndexedDB = useRef<fileSystem>(new indexedDBFileSystem())
  const localStorageFileSystem = useRef<fileSystem>(new localStorageFS())
  // url parameters to e2e test the fallbacks and error warnings
  const testmigrationFallback = useRef<boolean>(window.location.hash.includes('e2e_testmigration_fallback=true') && window.location.host === '127.0.0.1:8080' && window.location.protocol === 'http:')
  const testmigrationResult = useRef<boolean>(window.location.hash.includes('e2e_testmigration=true') && window.location.host === '127.0.0.1:8080' && window.location.protocol === 'http:')
  const testBlockStorage = useRef<boolean>(window.location.hash.includes('e2e_testblock_storage=true') && window.location.host === '127.0.0.1:8080' && window.location.protocol === 'http:')

  function loadAppComponent() {
    import('../../app')
      .then((AppComponent) => {
        const appComponent = new AppComponent.default()
        appComponent.run().then(() => {
          props.root.render(<RemixApp app={appComponent} />)
        })
      })
      .catch((err) => {
        _paq.push(['trackEvent', 'Preload', 'error', err && err.message])
        console.error('Error loading Remix:', err)
        setError(true)
      })
  }

  const downloadBackup = async () => {
    setShowDownloader(false)
    const fsUtility = new fileSystemUtility()
    await fsUtility.downloadBackup(remixFileSystems.current.fileSystems['localstorage'])
    await migrateAndLoad()
  }

  const migrateAndLoad = async () => {
    setShowDownloader(false)
    const fsUtility = new fileSystemUtility()
    const migrationResult = await fsUtility.migrate(localStorageFileSystem.current, remixIndexedDB.current)
    _paq.push(['trackEvent', 'Migrate', 'result', migrationResult ? 'success' : 'fail'])
    await setFileSystems()
  }

  const setFileSystems = async () => {
    const fsLoaded = await remixFileSystems.current.setFileSystem([testmigrationFallback.current || testBlockStorage.current ? null : remixIndexedDB.current, testBlockStorage.current ? null : localStorageFileSystem.current])
    if (fsLoaded) {
      console.log(fsLoaded.name + ' activated')
      _paq.push(['trackEvent', 'Storage', 'activate', fsLoaded.name])
      loadAppComponent()
    } else {
      _paq.push(['trackEvent', 'Storage', 'error', 'no supported storage'])
      setSupported(false)
    }
  }

  const testmigration = async () => {
    if (testmigrationResult.current) {
      const fsUtility = new fileSystemUtility()
      fsUtility.populateWorkspace(migrationTestData, remixFileSystems.current.fileSystems['localstorage'].fs)
    }
  }

  useEffect(() => {
    if (isElectron()) {
      loadAppComponent()
      return
    }
    async function loadStorage() {
      ;(await remixFileSystems.current.addFileSystem(remixIndexedDB.current)) || _paq.push(['trackEvent', 'Storage', 'error', 'indexedDB not supported'])
      ;(await remixFileSystems.current.addFileSystem(localStorageFileSystem.current)) || _paq.push(['trackEvent', 'Storage', 'error', 'localstorage not supported'])
      await testmigration()
      remixIndexedDB.current.loaded && (await remixIndexedDB.current.checkWorkspaces())
      localStorageFileSystem.current.loaded && (await localStorageFileSystem.current.checkWorkspaces())
      remixIndexedDB.current.loaded && (remixIndexedDB.current.hasWorkSpaces || !localStorageFileSystem.current.hasWorkSpaces ? await setFileSystems() : setShowDownloader(true))
      !remixIndexedDB.current.loaded && (await setFileSystems())
    }
    loadStorage()

    const abortController = new AbortController()
    const signal = abortController.signal
    async function showRemixTips() {
      const response = await axios.get('https://raw.githubusercontent.com/remix-project-org/remix-dynamics/main/ide/tips.json', {signal})
      if (signal.aborted) return
      const tips = response.data
      const index = Math.floor(Math.random() * (tips.length - 1))
      setTip(tips[index])
    }
    try {
      showRemixTips()
    } catch (e) {
      console.log(e)
    }
    return () => {
      abortController.abort()
    }
  }, [])

  return (
    <>
      <div className="preload-container">
        <div className="preload-logo pb-4">
          {logo}
          <div className="info-secondary splash">
            TrueIDE
            <br />
            <span className="version"> v{packageJson.version}</span>
          </div>
        </div>
        {!supported ? <div className="preload-info-container alert alert-warning">Your browser does not support any of the filesystems required by IDE. Either change the settings in your browser or use a supported browser.</div> : null}
        {error ? (
          <div className="preload-info-container alert alert-danger text-left">
            An unknown error has occurred while loading the application.
            <br></br>
            Doing a hard refresh might fix this issue:<br></br>
            <div className="pt-2">
              Windows:<br></br>- Chrome: CTRL + F5 or CTRL + Reload Button
              <br></br>- Firefox: CTRL + SHIFT + R or CTRL + F5<br></br>
            </div>
            <div className="pt-2">
              MacOS:<br></br>- Chrome & FireFox: CMD + SHIFT + R or SHIFT + Reload Button<br></br>
            </div>
            <div className="pt-2">
              Linux:<br></br>- Chrome & FireFox: CTRL + SHIFT + R<br></br>
            </div>
          </div>
        ) : null}
        {showDownloader ? (
          <div className="preload-info-container alert alert-info">
            This app will be updated now. Please download a backup of your files now to make sure you don't lose your work.
            <br></br>
            You don't need to do anything else, your files will be available when the app loads.
            <div
              onClick={async () => {
                await downloadBackup()
              }}
              data-id="downloadbackup-btn"
              className="btn btn-primary mt-1"
            >
              download backup
            </div>
            <div
              onClick={async () => {
                await migrateAndLoad()
              }}
              data-id="skipbackup-btn"
              className="btn btn-primary mt-1"
            >
              skip backup
            </div>
          </div>
        ) : null}
        {supported && !error && !showDownloader ? (
          <div>
            <div className="text-center">
              <i className="fas fa-spinner fa-spin fa-2x"></i>
            </div>
            {tip && (
              <div className="remix_tips text-center mt-3">
                <div>
                  <b>DID YOU KNOW</b>
                </div>
                <span>{tip}</span>
              </div>
            )}
          </div>
        ) : null}
      </div>
    </>
  )
}

const logo = (
  <svg width="100" height="105" viewBox="0 0 19 29" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path fill-rule="evenodd" clip-rule="evenodd" d="M3.71784 14.218L0 18.1682L9.17842 28.276L18.5892 18.4005L14.7552 14.218L10.6888 14.3341L9.41079 15.7283L7.90042 14.218H3.71784ZM5.80918 16.5416L9.17848 20.2594L12.7801 16.6578L14.2905 18.2843L9.29466 23.5126L4.41499 18.052L5.80918 16.5416Z" fill="#FDFDFD" />
    <path d="M0 10.1516L9.41079 0.276062L17.5436 9.3383L15.3361 11.5458L9.41079 5.03955L4.41494 10.1516L9.29461 15.6122L10.4564 14.3342L8.13278 11.662L10.4564 9.3383L14.9876 14.4503L9.17842 20.2595L0 10.1516Z" fill="url(#paint0_linear_2583_1478)" />
    <defs>
      <linearGradient id="paint0_linear_2583_1478" x1="1.18419" y1="4.76775" x2="17.514" y2="8.195" gradientUnits="userSpaceOnUse">
        <stop stop-color="#82EB7C" />
        <stop offset="0.3749" stop-color="#27B782" />
        <stop offset="0.375" stop-color="#26B682" />
        <stop offset="1" stop-color="#6BD2C9" />
      </linearGradient>
    </defs>
  </svg>
)
